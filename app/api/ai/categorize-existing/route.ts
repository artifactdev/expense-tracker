import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  buildCategoryTree,
  formatCategoryTreeForPrompt,
  getAISettings,
  suggestCategoriesBatch,
  type BatchTransaction,
} from '@/services/ai';
import { capitalizeFirstLetter } from '@/utils/capitalize-first-letter';
import { LOCAL_USER_ID } from '@/utils/const';

// Allow up to 5 minutes for bulk categorization
export const maxDuration = 300;

const BATCH_SIZE = 15;

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const mode: 'uncategorized' | 'all' = body.mode === 'all' ? 'all' : 'uncategorized';

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: unknown) => controller.enqueue(enc.encode(sseEvent(data)));

      try {
        const settings = await getAISettings();
        if (!settings.aiEnabled || !settings.aiEndpoint || !settings.aiModel) {
          send({ type: 'error', error: 'AI is not configured or disabled' });
          controller.close();
          return;
        }

        // Load user categories with hierarchy
        const userCatRows = await prisma.userCategory.findMany({
          where: { userId: LOCAL_USER_ID },
          include: { category: true },
        });
        const flatCats = userCatRows.map(uc => ({
          id: uc.category.id,
          name: uc.category.name,
          parentId: uc.category.parentId,
        }));
        const tree = buildCategoryTree(flatCats);
        const categoryTreePrompt = formatCategoryTreeForPrompt(tree);

        // Pre-build category map (name → { id, parentId }) for quick lookups
        const allDbCats = await prisma.category.findMany({
          select: { id: true, name: true, parentId: true },
        });
        const categoryByName = new Map<string, { id: string; parentId: string | null }>();
        for (const c of allDbCats) categoryByName.set(c.name, { id: c.id, parentId: c.parentId });

        const userCategoryIds = new Set<string>(userCatRows.map(uc => uc.categoryId));

        // Load transactions to process
        const transactions = await prisma.transaction.findMany({
          where: {
            userId: LOCAL_USER_ID,
            ...(mode === 'uncategorized' ? { categories: { none: {} } } : {}),
          },
          select: { id: true, name: true, amount: true, counterparty: true, notes: true },
          orderBy: { date: 'desc' },
        });

        if (transactions.length === 0) {
          send({ type: 'done', ok: true, processed: 0, skipped: 0, failed: 0, total: 0 });
          controller.close();
          return;
        }

        send({ type: 'start', total: transactions.length });

        let processed = 0;
        let failed = 0;
        let skipped = 0;
        let done = 0;

        // Helper: resolve a category name to an ID, creating if needed
        const resolveCategoryId = async (name: string): Promise<string | null> => {
          let entry = categoryByName.get(name);
          if (!entry) {
            try {
              const created = await prisma.category.create({
                data: {
                  name: capitalizeFirstLetter(name),
                  slug: name.toLowerCase().replace(/\s+/g, '-'),
                },
              });
              entry = { id: created.id, parentId: null };
              categoryByName.set(name, entry);
            } catch {
              const existing = await prisma.category.findFirst({ where: { name } });
              if (!existing) return null;
              entry = { id: existing.id, parentId: existing.parentId };
              categoryByName.set(name, entry);
            }
          }
          if (!userCategoryIds.has(entry.id)) {
            await prisma.userCategory.upsert({
              where: { userId_categoryId: { userId: LOCAL_USER_ID, categoryId: entry.id } },
              update: {},
              create: { userId: LOCAL_USER_ID, categoryId: entry.id },
            });
            userCategoryIds.add(entry.id);
          }
          return entry.id;
        };

        // Process in batches
        for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
          const batch = transactions.slice(i, i + BATCH_SIZE);
          const batchInput: BatchTransaction[] = batch.map((tx, j) => ({
            idx: j + 1,
            name: tx.name,
            amount: tx.amount,
            counterparty: tx.counterparty,
            notes: tx.notes,
          }));

          let batchResult;
          try {
            batchResult = await suggestCategoriesBatch(batchInput, categoryTreePrompt, settings);
          } catch {
            // Entire batch failed
            for (const tx of batch) {
              done++;
              failed++;
              send({
                type: 'progress',
                current: done,
                total: transactions.length,
                name: tx.name,
                counterparty: tx.counterparty,
                suggestions: [],
                status: 'failed',
              });
            }
            continue;
          }

          // Process each result in the batch
          for (let j = 0; j < batch.length; j++) {
            const tx = batch[j];
            const suggestions = batchResult?.[j + 1] ?? [];

            if (suggestions.length === 0) {
              done++;
              skipped++;
              send({
                type: 'progress',
                current: done,
                total: transactions.length,
                name: tx.name,
                counterparty: tx.counterparty,
                suggestions: [],
                status: 'skipped',
              });
              continue;
            }

            // Resolve category IDs (max 2: parent + child)
            const categoryIds = (await Promise.all(suggestions.map(resolveCategoryId))).filter(
              (id): id is string => id !== null
            );

            if (categoryIds.length === 0) {
              done++;
              skipped++;
              send({
                type: 'progress',
                current: done,
                total: transactions.length,
                name: tx.name,
                counterparty: tx.counterparty,
                suggestions: [],
                status: 'skipped',
              });
              continue;
            }

            try {
              await prisma.$transaction(async tx_ => {
                if (mode === 'all') {
                  await tx_.transactionCategory.deleteMany({ where: { transactionId: tx.id } });
                }
                for (const cid of categoryIds.slice(0, 2)) {
                  await tx_.transactionCategory.upsert({
                    where: {
                      transactionId_categoryId: { transactionId: tx.id, categoryId: cid },
                    },
                    update: {},
                    create: { transactionId: tx.id, categoryId: cid },
                  });
                }
              });

              done++;
              processed++;
              send({
                type: 'progress',
                current: done,
                total: transactions.length,
                name: tx.name,
                counterparty: tx.counterparty,
                suggestions,
                status: 'ok',
              });
            } catch {
              done++;
              failed++;
              send({
                type: 'progress',
                current: done,
                total: transactions.length,
                name: tx.name,
                counterparty: tx.counterparty,
                suggestions: [],
                status: 'failed',
              });
            }
          }
        }

        send({ type: 'done', ok: true, total: transactions.length, processed, skipped, failed });
      } catch (e) {
        send({ type: 'error', error: e instanceof Error ? e.message : 'Internal error' });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
