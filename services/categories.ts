import { prisma } from '@/lib/prisma';

type Args = {
  categoriesNames: string[];
};

export const getCategoriesId = async ({ categoriesNames }: Args) => {
  const categories = await prisma.category.findMany({
    where: { name: { in: categoriesNames } },
    select: { id: true, name: true, common: true },
  });
  return { ok: true, categories: categories.map(cat => cat.id) };
};
