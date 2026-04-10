'use client';

import { useMemo, useState } from 'react';

import { Plus, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { useCurrency } from '@/hooks/use-currency';
import type { TransactionObjBack } from '@/types';
import { formatAmount } from '@/utils/format-amount';
import type { PieChartData } from '../types/pie-chart';
import {
  aggregateByParentCategory,
  aggregateSubcategories,
  buildParentLookup,
  type CategoryNode,
} from '../utils/aggregate-transactions-per-categories';

type Props = {
  filteredData: TransactionObjBack[] | undefined;
  categories: CategoryNode[];
  isLoading: boolean;
};

const STORAGE_KEY = 'dashboard-pinned-categories';

const loadPinned = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
};

const savePinned = (pinned: string[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
};

export const CategoryTiles = ({ filteredData, categories, isLoading }: Props) => {
  const [pinned, setPinned] = useState<string[]>(loadPinned);
  const { currency } = useCurrency();

  const expenses = useMemo(() => (filteredData ?? []).filter(t => t.amount < 0), [filteredData]);

  const parentLookup = useMemo(() => buildParentLookup(categories), [categories]);

  const parentTotals: PieChartData = useMemo(
    () => aggregateByParentCategory(expenses, parentLookup),
    [expenses, parentLookup]
  );

  // Available parents that have actual spending and aren't pinned yet
  const availableParents = useMemo(
    () =>
      parentTotals
        .filter((p: { name: string; value: number }) => !pinned.includes(p.name))
        .map((p: { name: string; value: number }) => p.name),
    [parentTotals, pinned]
  );

  const addTile = (name: string) => {
    const next = [...pinned, name];
    setPinned(next);
    savePinned(next);
  };

  const removeTile = (name: string) => {
    const next = pinned.filter(p => p !== name);
    setPinned(next);
    savePinned(next);
  };

  if (isLoading || !filteredData || categories.length === 0) return null;

  // Only render tiles that have data in current period
  const activePinned = pinned.filter((name: string) =>
    parentTotals.some((p: { name: string; value: number }) => p.name === name)
  );

  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
      {activePinned.map(parentName => {
        const breakdown = aggregateSubcategories(expenses, parentName, categories);
        if (breakdown.total === 0) return null;

        return (
          <Card key={parentName} className='relative'>
            <Button
              variant='ghost'
              size='icon'
              className='absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive'
              onClick={() => removeTile(parentName)}
            >
              <X className='h-3.5 w-3.5' />
            </Button>
            <CardHeader className='pb-2'>
              <CardTitle className='text-base'>{parentName}</CardTitle>
              <p className='text-2xl font-bold tabular-nums'>
                {formatAmount(breakdown.total)} {currency}
              </p>
            </CardHeader>
            <CardContent className='space-y-2.5'>
              {breakdown.children.map(child => {
                const pct = breakdown.total > 0 ? (child.value / breakdown.total) * 100 : 0;
                return (
                  <div key={child.name} className='space-y-1'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>{child.name}</span>
                      <span className='font-medium tabular-nums'>
                        {formatAmount(child.value)} {currency}
                      </span>
                    </div>
                    <Progress value={pct} className='h-1.5' />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* Add tile button */}
      {availableParents.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Card className='flex cursor-pointer items-center justify-center border-dashed transition-colors hover:border-primary/50 hover:bg-muted/30'>
              <div className='flex flex-col items-center gap-2 py-8 text-muted-foreground'>
                <Plus className='h-8 w-8' />
                <span className='text-sm font-medium'>Kategorie hinzufügen</span>
              </div>
            </Card>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='center' className='max-h-[300px] overflow-y-auto'>
            {availableParents.map((name: string) => {
              const total =
                parentTotals.find((p: { name: string; value: number }) => p.name === name)?.value ??
                0;
              return (
                <DropdownMenuItem key={name} onClick={() => addTile(name)}>
                  <span className='flex-1'>{name}</span>
                  <Badge variant='secondary' className='ml-2 tabular-nums'>
                    {formatAmount(total)} {currency}
                  </Badge>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
