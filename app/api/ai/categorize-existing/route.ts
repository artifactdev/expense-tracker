import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getAISettings } from '@/services/ai';
import { capitalizeFirstLetter } from '@/utils/capitalize-first-letter';
import { LOCAL_USER_ID } from '@/utils/const';

// Allow up to 5 minutes for bulk categorization
export const maxDuration = 300;

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

        // Load user categories for suggestions
        const userCatRows = await prisma.userCategory.findMany({
          where: { userId: LOCAL_USER_ID },
          include: { category: true },
        });
        const commonCats = await prisma.category.findMany({ where: { common: true } });
        const allCategoryNames = Array.from(
          new Set([...commonCats.map(c => c.name), ...userCatRows.map(uc => uc.category.name)])
        );

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

        const baseSystemPrompt = `You are a personal finance assistant. Your job is to assign categories to bank transactions.
Rules:
- ALWAYS prefer categories from the provided list. Only invent a new category name if none of the existing ones is even remotely suitable.
- NEVER return vague or meaningless categories like "Generic", "Other", "Miscellaneous", or "Unknown".
- Base your decision primarily on the payee/counterparty name and the transaction description, not just the amount.
- Return a JSON array of strings with 1–3 category names. Nothing else.
Example: ["Groceries", "Food"]`;

        const systemPrompt = settings.aiSystemPrompt
          ? `${settings.aiSystemPrompt}\n\n${baseSystemPrompt}`
          : baseSystemPrompt;

        const endpoint = settings.aiEndpoint.replace(/\/$/, '');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (settings.aiApiKey) headers['Authorization'] = `Bearer ${settings.aiApiKey}`;

        let processed = 0;
        let failed = 0;
        let skipped = 0;

        for (const tx of transactions) {
          try {
            const promptLines: string[] = [];
            if (tx.counterparty) promptLines.push(`Payee/Counterparty: "${tx.counterparty}"`);
            promptLines.push(`Transaction description: "${tx.name}"`);
            promptLines.push(`Amount: ${tx.amount} (negative = expense, positive = income)`);
            if (tx.notes) promptLines.push(`Notes: "${tx.notes}"`);
            promptLines.push(
              `Available categories: ${allCategoryNames.length > 0 ? allCategoryNames.join(', ') : 'none yet'}`
            );
            promptLines.push(`\nReturn a JSON array with 1–3 category names from the list above.`);
            const userPrompt = promptLines.join('\n');

            const res = await fetch(`${endpoint}/chat/completions`, {
              method: 'POST',
              headers,
              signal: AbortSignal.timeout(60000),
              body: JSON.stringify({
                model: settings.aiModel,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
                temperature: 0.2,
                max_tokens: settings.aiMaxTokens ?? 2048,
              }),
            });

            if (!res.ok) {
              failed++;
              send({
                type: 'progress',
                current: processed + skipped + failed,
                total: transactions.length,
                name: tx.name,
                counterparty: tx.counterparty,
                suggestions: [],
                status: 'failed',
              });
              continue;
            }

            const json = await res.json();
            // Reasoning models (Qwen, DeepSeek) put output in `reasoning` when content is null
            const rawContent: string | null = json.choices?.[0]?.message?.content ?? null;
            const rawReasoning: string | null = json.choices?.[0]?.message?.reasoning ?? null;
            const raw: string = rawContent ?? rawReasoning ?? '';
            // Strip reasoning blocks emitted by thinking models (e.g. Qwen, DeepSeek)
            const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            // Greedy match: find the LAST [...] array in the response
            const match = cleaned.match(/\[[\s\S]*\]/);
            let suggestions: string[] = [];
            try {
              const parsed = JSON.parse(match ? match[0] : cleaned);
              if (Array.isArray(parsed)) {
                suggestions = parsed.filter((s): s is string => typeof s === 'string').slice(0, 3);
              }
            } catch {
              /* ignore */
            }

            if (suggestions.length === 0) {
              skipped++;
              send({
                type: 'progress',
                current: processed + skipped + failed,
                total: transactions.length,
                name: tx.name,
                counterparty: tx.counterparty,
                suggestions: [],
                status: 'skipped',
              });
              continue;
            }

            // Resolve/create category IDs
            const categoryIds = await Promise.all(
              suggestions.map(async name => {
                const existing = await prisma.category.findFirst({
                  where: { name },
                });
                if (existing) {
                  await prisma.userCategory.upsert({
                    where: {
                      userId_categoryId: { userId: LOCAL_USER_ID, categoryId: existing.id },
                    },
                    update: {},
                    create: { userId: LOCAL_USER_ID, categoryId: existing.id },
                  });
                  return existing.id;
                }
                const created = await prisma.category.create({
                  data: {
                    name: capitalizeFirstLetter(name),
                    slug: name.toLowerCase().replace(/\s+/g, '-'),
                  },
                });
                await prisma.userCategory.create({
                  data: { userId: LOCAL_USER_ID, categoryId: created.id },
                });
                return created.id;
              })
            );

            // Apply categories (upsert — keep existing + add new)
            await prisma.$transaction(async tx_ => {
              if (mode === 'all') {
                await tx_.transactionCategory.deleteMany({ where: { transactionId: tx.id } });
              }
              for (const cid of categoryIds) {
                await tx_.transactionCategory.upsert({
                  where: { transactionId_categoryId: { transactionId: tx.id, categoryId: cid } },
                  update: {},
                  create: { transactionId: tx.id, categoryId: cid },
                });
              }
            });

            // Add new category names to allCategoryNames for subsequent iterations
            for (const name of suggestions) {
              if (!allCategoryNames.includes(name)) allCategoryNames.push(name);
            }

            processed++;
            send({
              type: 'progress',
              current: processed + skipped + failed,
              total: transactions.length,
              name: tx.name,
              counterparty: tx.counterparty,
              suggestions,
              status: 'ok',
            });

            // Brief pause to avoid overwhelming the AI server
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch {
            failed++;
            send({
              type: 'progress',
              current: processed + skipped + failed,
              total: transactions.length,
              name: tx.name,
              counterparty: tx.counterparty,
              suggestions: [],
              status: 'failed',
            });
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
