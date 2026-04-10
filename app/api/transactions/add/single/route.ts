import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import type { TransactionObj } from '@/types';
import { capitalizeFirstLetter } from '@/utils/capitalize-first-letter';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

interface ReqBody {
  transaction: TransactionObj;
}

export const POST = async (req: NextRequest) => {
  try {
    const { transaction } = (await req.json()) as ReqBody;
    const { categories, ...transactionData } = transaction;

    // Process each category
    const processedCategoryIds = await Promise.all(
      categories.map(async category => {
        if (!category.newEntry) return category.id as string;

        const existing = await prisma.category.findFirst({
          where: { name: { equals: category.name } },
        });
        if (existing) {
          await prisma.userCategory.upsert({
            where: { userId_categoryId: { userId: LOCAL_USER_ID, categoryId: existing.id } },
            update: {},
            create: { userId: LOCAL_USER_ID, categoryId: existing.id },
          });
          return existing.id;
        }
        const created = await prisma.category.create({
          data: {
            name: capitalizeFirstLetter(category.name),
            slug: category.name.toLowerCase().replace(/\s+/g, '-'),
          },
        });
        await prisma.userCategory.create({
          data: { userId: LOCAL_USER_ID, categoryId: created.id },
        });
        return created.id;
      })
    );

    const created = await prisma.transaction.create({
      data: {
        ...transactionData,
        userId: LOCAL_USER_ID,
        categories: { create: processedCategoryIds.map(id => ({ categoryId: id })) },
      },
      include: { categories: { include: { category: true } } },
    });

    return NextResponse.json({ ok: true, data: created }, { status: 200 });
  } catch (err) {
    console.log('ERROR CREATING TRANSACTION', err);
    return NextResponse.json(
      { ok: false, error: errorMessages.createTransaction },
      { status: 500 }
    );
  }
};
