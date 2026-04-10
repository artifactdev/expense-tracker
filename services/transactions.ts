import { cache } from 'react';

import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { FilteredTransactionsSchema } from '@/schemas/filtered-transactions-schema';
import type { Categories } from '@/types';
import type { TransactionObjBack } from '@/types/transaction';
import { capitalizeFirstLetter } from '@/utils/capitalize-first-letter';
import { errorMessages } from '@/utils/const';

type FilteredTransactions = z.infer<typeof FilteredTransactionsSchema>;

/** Maps a Prisma transaction row to the shared TransactionObjBack shape */
function mapTransaction(t: {
  id: string;
  userId: string;
  name: string;
  amount: number;
  date: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  categories: { category: { id: string; name: string; common: boolean } }[];
}): TransactionObjBack {
  return {
    id: t.id,
    userId: t.userId,
    name: t.name,
    amount: t.amount,
    date: t.date,
    notes: t.notes ?? undefined,
    categories: t.categories.map(tc => ({
      id: tc.category.id,
      name: tc.category.name,
      common: tc.category.common,
    })),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export const revalidate = 3600;

export const getAllTransactionsPerUser = cache(async (userId: string) => {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    include: { categories: { include: { category: true } } },
  });
  return { ok: true, transactions: transactions.map(mapTransaction) };
});

export const getFilteredTransactions = async ({
  userId,
  startDate,
  endDate,
  transType,
  filterType,
  filterOperator,
  filterValue,
  filteredCategories,
  offset,
  limit,
}: FilteredTransactions) => {
  FilteredTransactionsSchema.parse({
    userId,
    startDate,
    endDate,
    transType,
    filterType,
    filterOperator,
    filterValue,
    filteredCategories,
  });

   
  const where: Record<string, any> = { userId };

  if (startDate && endDate) {
    where.date = { gte: startDate, lte: endDate };
  }

  if (transType === 'incomes') {
    where.amount = { gte: 0 };
  } else if (transType === 'expenses') {
    where.amount = { lt: 0 };
  }

  if (filterType === 'Amount' && filterValue && Number(filterValue)) {
    where.amount = { [filterOperator === 'gt' ? 'gt' : 'lt']: Number(filterValue) };
  } else if (filterType === 'Name' && filterValue) {
    where.OR = [
      { name: { contains: filterValue, mode: 'insensitive' } },
      { notes: { contains: filterValue, mode: 'insensitive' } },
    ];
  }

  if (filteredCategories && filteredCategories.length > 0) {
    const catRecords = await prisma.category.findMany({
      where: { name: { in: filteredCategories } },
      select: { id: true },
    });
    const categoryIds = catRecords.map(c => c.id);
    where.categories = { some: { categoryId: { in: categoryIds } } };
  }

  const include = { categories: { include: { category: true } } };

  const [totalCount, rows] =
    offset !== undefined && limit !== undefined
      ? await Promise.all([
          prisma.transaction.count({ where }),
          prisma.transaction.findMany({
            where,
            orderBy: { date: 'desc' },
            skip: offset,
            take: limit,
            include,
          }),
        ])
      : await Promise.all([
          prisma.transaction.count({ where }),
          prisma.transaction.findMany({ where, orderBy: { date: 'desc' }, include }),
        ]);

  return {
    ok: true,
    data: { list: rows.map(mapTransaction), totalCount },
    error: null,
  };
};

export const deleteTransactionsInBulk = async ({
  userId,
  transactions,
}: {
  userId: string;
  transactions: { transactionIds: string; categoriesId: Categories[] }[];
}) => {
  const ids = transactions.map(t => t.transactionIds);

  const deletedCount = await prisma.$transaction(async tx => {
    // Remove junction rows first (cascade handles it but being explicit)
    await tx.transactionCategory.deleteMany({ where: { transactionId: { in: ids } } });
    const result = await tx.transaction.deleteMany({ where: { id: { in: ids }, userId } });

    // For non-common categories: remove from UserCategory if no transactions left
    const allCategoryIds = [
      ...new Set(
        transactions.flatMap(t =>
          t.categoriesId.filter(cat => !cat.common).map(cat => cat.id as string)
        )
      ),
    ];
    for (const catId of allCategoryIds) {
      const remaining = await tx.transactionCategory.count({
        where: { categoryId: catId, transaction: { userId } },
      });
      if (remaining === 0) {
        await tx.userCategory.deleteMany({ where: { userId, categoryId: catId } });
      }
    }

    return result.count;
  });

  return { ok: true, deletedCount };
};

export const updateSingleTransaction = async ({
  transaction,
}: {
  transaction: TransactionObjBack & { id: string };
}) => {
  const { id, categories, userId, createdAt, updatedAt, ...data } = transaction;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { categories: { include: { category: true } } },
  });
  if (!user) throw new Error(errorMessages.generic);

  const processedCategoryIds = await Promise.all(
    categories.map(async cat => {
      if (!('newEntry' in cat) || !cat.newEntry) return cat.id as string;

      // Find or create the category
      const existing = await prisma.category.findFirst({
        where: { name: { equals: cat.name } },
      });
      if (existing) {
        await prisma.userCategory.upsert({
          where: { userId_categoryId: { userId, categoryId: existing.id } },
          update: {},
          create: { userId, categoryId: existing.id },
        });
        return existing.id;
      }
      const created = await prisma.category.create({
        data: {
          name: capitalizeFirstLetter(cat.name),
          slug: cat.name.toLowerCase().replace(/\s+/g, '-'),
        },
      });
      await prisma.userCategory.create({ data: { userId, categoryId: created.id } });
      return created.id;
    })
  );

  const updated = await prisma.$transaction(async tx => {
    await tx.transactionCategory.deleteMany({ where: { transactionId: id } });
    return tx.transaction.update({
      where: { id },
      data: {
        ...data,
        categories: { create: processedCategoryIds.map(cid => ({ categoryId: cid })) },
      },
      include: { categories: { include: { category: true } } },
    });
  });

  return { ok: true, data: mapTransaction(updated) };
};
