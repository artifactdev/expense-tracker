import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { TransactionsArraySchema } from '@/schemas/transaction-endpoint-body-schema';
import type { Category, TransactionEndpointBody } from '@/types';
import { capitalizeFirstLetter } from '@/utils/capitalize-first-letter';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

interface ReqObjI {
  transactions: TransactionEndpointBody[];
}

export const POST = async (req: NextRequest) => {
  const data = (await req.json()) as ReqObjI;
  const { transactions } = data;

  try {
    TransactionsArraySchema.parse(transactions);

    // Fetch all existing categories once
    const allCategories = await prisma.category.findMany({ select: { id: true, name: true } });

    // Collect category names and find/create them
    const allCategoryNames = new Set(
      transactions.flatMap(t => t.selectedCategories.map((c: Category) => c.name.toLowerCase()))
    );

    const categoryMap = new Map<string, string>(); // name.toLowerCase() -> id

    for (const catName of allCategoryNames) {
      const existing = allCategories.find(c => c.name.toLowerCase() === catName);
      if (existing) {
        categoryMap.set(catName, existing.id);
      } else {
        const created = await prisma.category.create({
          data: { name: capitalizeFirstLetter(catName), slug: catName.replace(/\s+/g, '-') },
        });
        categoryMap.set(catName, created.id);
      }
    }

    // Ensure user has all these categories
    for (const catId of categoryMap.values()) {
      await prisma.userCategory.upsert({
        where: { userId_categoryId: { userId: LOCAL_USER_ID, categoryId: catId } },
        update: {},
        create: { userId: LOCAL_USER_ID, categoryId: catId },
      });
    }

    // Insert all transactions
    let insertedCount = 0;
    for (const trans of transactions) {
      const categoryIds = trans.selectedCategories
        .map((c: Category) => categoryMap.get(c.name.toLowerCase()))
        .filter(Boolean) as string[];

      await prisma.transaction.create({
        data: {
          name: trans.name,
          amount: trans.amount,
          date: trans.date,
          notes: trans.notes ?? null,
          counterparty: trans.counterparty ?? null,
          account: trans.account ?? null,
          userId: LOCAL_USER_ID,
          categories: { create: categoryIds.map(id => ({ categoryId: id })) },
        },
      });
      insertedCount++;
    }

    return NextResponse.json({ ok: true, insertedTransactions: insertedCount }, { status: 201 });
  } catch (err) {
    console.log('ERROR UPLOADING TRANS', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: errorMessages.incorrectTransactionsData },
        { status: 400 }
      );
    }
    const errorMessage = err instanceof Error ? err.message : errorMessages.addingTransaction;
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};
