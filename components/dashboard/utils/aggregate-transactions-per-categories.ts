import type { TransactionObjBack } from '@/types';
import { PieChartData } from '../types/pie-chart';

type Props = {
  transactions: TransactionObjBack[];
};

// Recieves the filtered incomes or expenses transactions
export const aggregateTransactionsPerCategories = ({ transactions }: Props): PieChartData => {
  const categoryTotals: Record<string, number> = {};

  transactions.forEach(transaction => {
    transaction.categories.forEach(category => {
      // If a transaction belongs to multiple categories, each category gets the full amount
      const amount = Math.abs(transaction.amount);
      if (categoryTotals[category.name]) {
        categoryTotals[category.name] += amount;
      } else {
        categoryTotals[category.name] = amount;
      }
    });
  });

  return Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value: Number(value.toFixed(2)),
  }));
};

// ---------------------------------------------------------------------------
// Category hierarchy helpers for dashboard
// ---------------------------------------------------------------------------

export type CategoryNode = {
  id: string;
  name: string;
  parentId: string | null;
  children?: CategoryNode[];
};

/** Build a map: categoryId → parentName (or own name if root) */
export const buildParentLookup = (categories: CategoryNode[]): Map<string, string> => {
  const lookup = new Map<string, string>();
  for (const cat of categories) {
    // Root category
    lookup.set(cat.id, cat.name);
    if (cat.children) {
      for (const child of cat.children) {
        // Map child → parent name
        lookup.set(child.id, cat.name);
      }
    }
  }
  return lookup;
};

/** Aggregate transactions by parent category */
export const aggregateByParentCategory = (
  transactions: TransactionObjBack[],
  parentLookup: Map<string, string>
): PieChartData => {
  const totals: Record<string, number> = {};
  for (const tx of transactions) {
    const amount = Math.abs(tx.amount);
    for (const cat of tx.categories) {
      const parentName = parentLookup.get(cat.id as string) ?? cat.name;
      totals[parentName] = (totals[parentName] ?? 0) + amount;
    }
  }
  return Object.entries(totals)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
};

export type CategoryBreakdown = {
  parentName: string;
  total: number;
  children: { name: string; value: number }[];
};

/** Get detailed breakdown for a specific parent category */
export const aggregateSubcategories = (
  transactions: TransactionObjBack[],
  parentName: string,
  categories: CategoryNode[]
): CategoryBreakdown => {
  const parent = categories.find(c => c.name === parentName);
  const childIds = new Set(parent?.children?.map(c => c.id) ?? []);
  const parentId = parent?.id;

  const totals: Record<string, number> = {};
  let total = 0;

  for (const tx of transactions) {
    const amount = Math.abs(tx.amount);
    for (const cat of tx.categories) {
      const catId = cat.id as string;
      // Only include categories belonging to this parent
      if (catId === parentId || childIds.has(catId)) {
        totals[cat.name] = (totals[cat.name] ?? 0) + amount;
        total += amount;
      }
    }
  }

  return {
    parentName,
    total: Number(total.toFixed(2)),
    children: Object.entries(totals)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value),
  };
};
