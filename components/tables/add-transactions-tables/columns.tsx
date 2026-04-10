'use client';

import { ColumnDef } from '@tanstack/react-table';

import { CategoriesComboboxInput } from '@/components/tables/add-transactions-tables/categories-combobox-input';
import type { TransactionBulk } from '@/types';
import { AmountCell } from '../amount-cell';

export const columns: ColumnDef<TransactionBulk>[] = [
  {
    accessorKey: 'Concept',
    header: 'NAME',
  },
  {
    accessorKey: 'Counterparty',
    header: 'COUNTERPARTY',
    cell: ({ getValue }) => (
      <div className='min-w-[120px] max-w-[200px] truncate text-xs text-muted-foreground'>
        {(getValue() as string) ?? '—'}
      </div>
    ),
  },
  {
    accessorKey: 'Amount',
    header: 'AMOUNT',
    cell: ({ getValue }) => <AmountCell textLeft amount={getValue() as string} />,
  },
  {
    accessorKey: 'Date',
    header: 'DATE',
    cell: ({ getValue }) => <div className='min-w-[90px]'>{getValue() as string}</div>,
  },
  {
    accessorKey: 'Account',
    header: 'ACCOUNT',
    cell: ({ getValue }) => (
      <div className='min-w-[100px] max-w-[160px] truncate font-mono text-xs text-muted-foreground'>
        {(getValue() as string) ?? '—'}
      </div>
    ),
  },
  {
    accessorKey: 'PaymentType',
    header: 'TYPE',
    cell: ({ getValue }) => (
      <div className='min-w-[80px] max-w-[140px] truncate text-xs text-muted-foreground'>
        {(getValue() as string) ?? '—'}
      </div>
    ),
  },
  {
    accessorKey: 'Categories',
    header: 'CATEGORIES',
    cell: ({ row }) => (
      <CategoriesComboboxInput
        selectedCategories={row.original.selectedCategories ?? []}
        selectedRow={row.index}
      />
    ),
  },
  {
    accessorKey: 'Notes',
    header: 'NOTES',
  },
];
