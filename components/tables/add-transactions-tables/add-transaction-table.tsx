'use client';

import React, { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Bot, FileUp, Undo } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { UploadTransactionsModal } from '@/components/modal/transactions/upload-transactions-modal';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { useAddTransactionTable } from '@/hooks/use-add-transaction-table';
import { useFetch } from '@/hooks/use-fetch';
import type { AISettings } from '@/schemas/update-ai-settings-schema';
import type {
  EnhancedCategory,
  TransactionBulk,
  TransactionBulkResponse,
  TransactionEndpointBody,
} from '@/types';
import {
  URL_AI_SETTINGS,
  URL_AI_SUGGEST_CATEGORIES,
  URL_UPLOAD_BULK_TRANSACTION,
} from '@/utils/const';
import { parseAmount } from '@/utils/parse-amount';
import { parseToBackendDate } from '@/utils/parse-to-backend-date';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  CSVDateFormat: string;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
}

export const AddTransactionsTable = <TData, TValue>({
  columns,
  data,
  CSVDateFormat,
  setCurrentStep,
}: DataTableProps<TData, TValue>) => {
  const [open, setOpen] = useState(false);
  const [isUploadingTrans, setIsUploadingTrans] = useState(false);
  const [isAICategorizing, setIsAICategorizing] = useState(false);
  const { fetchPetition } = useFetch();
  const { toast } = useToast();
  const router = useRouter();
  const { userCategories, updateTransactionCategories, setUserCategories } =
    useAddTransactionTable();

  const { data: aiSettings } = useQuery<AISettings>({
    queryKey: [URL_AI_SETTINGS],
    queryFn: async () => {
      const res = await fetch(URL_AI_SETTINGS);
      return res.json();
    },
  });

  const aiEnabled = aiSettings?.aiEnabled && aiSettings?.aiCategoriesEnabled;

  const handleAICategorizeAll = async () => {
    setIsAICategorizing(true);
    const transactions = data as TransactionBulk[];
    let successCount = 0;

    for (const trans of transactions) {
      try {
        const res = await fetch(URL_AI_SUGGEST_CATEGORIES, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trans.Concept,
            amount: parseAmount(trans.Amount),
            counterparty: trans.Counterparty,
            notes: trans.Notes,
          }),
        });
        const result: { ok: boolean; suggestions?: string[] } = await res.json();
        if (result.ok && result.suggestions && result.suggestions.length > 0) {
          const suggested: EnhancedCategory[] = result.suggestions.map(s => {
            const existing = userCategories.find(c => c.name.toLowerCase() === s.toLowerCase());
            return existing ?? { id: crypto.randomUUID(), name: s, newEntry: true };
          });
          // Add new categories to user categories pool
          suggested.forEach(s => {
            if (
              s.newEntry &&
              !userCategories.some(c => c.name.toLowerCase() === s.name.toLowerCase())
            ) {
              setUserCategories(prev => [...prev, s]);
            }
          });
          // AI returns [Parent, Child] — replace instead of merge
          updateTransactionCategories(trans.id, suggested.slice(0, 2));
          successCount++;
        }
      } catch {
        // skip individual failures
      }
    }

    toast({
      title: 'AI categorization complete',
      description: `Suggested categories for ${successCount} of ${transactions.length} transactions.`,
      variant: successCount > 0 ? 'success' : 'default',
    });
    setIsAICategorizing(false);
  };

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const onUploadTrans = async () => {
    setIsUploadingTrans(true);
    const parsedTrans: TransactionEndpointBody[] = (data as TransactionBulk[]).map(trans => {
      const parsedBackendDate = parseToBackendDate({
        dateString: trans.Date,
        dateFormatFromCSV: CSVDateFormat,
      });
      return {
        name: trans.Concept,
        amount: parseAmount(trans.Amount),
        date: parsedBackendDate,
        notes: trans.Notes,
        counterparty: trans.Counterparty,
        account: trans.Account,
        paymentType: trans.PaymentType,
        selectedCategories:
          trans.selectedCategories && trans.selectedCategories.length > 0
            ? trans.selectedCategories
            : [
                {
                  id: 'sonstige-ausgaben',
                  name: 'Sonstige Ausgaben',
                  common: true,
                },
              ],
      };
    });

    const res = await fetchPetition<TransactionBulkResponse>({
      url: URL_UPLOAD_BULK_TRANSACTION,
      method: 'POST',
      body: { transactions: parsedTrans },
    });

    if (res.error) {
      toast({
        variant: 'destructive',
        title: 'Error uploading the transactions!',
        description: res.error,
      });
    }
    if (res.insertedTransactions !== undefined && !res.error) {
      toast({
        variant: 'success',
        title: 'Transactions uploaded correctly!',
        description: 'The transactions has been uploaded!',
      });
      router.refresh();
      router.push(`/dashboard/transactions/list`);
    }
    setIsUploadingTrans(false);
  };

  return (
    <>
      <UploadTransactionsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={onUploadTrans}
        loading={isUploadingTrans}
      />
      <div className='my-2 flex items-center justify-between'>
        <Button onClick={() => setCurrentStep(0)} variant='outline'>
          <Undo className='mr-2 h-4 w-4' /> Go to previous step
        </Button>
        <div className='flex items-center gap-2'>
          {aiEnabled && (
            <Button onClick={handleAICategorizeAll} variant='outline' disabled={isAICategorizing}>
              <Bot className='mr-2 h-4 w-4' />
              {isAICategorizing ? 'Categorizing...' : 'AI categorize all'}
            </Button>
          )}
          <Button onClick={() => setOpen(true)}>
            <FileUp className='mr-2 h-4 w-4' /> Upload transactions
          </Button>
        </div>
      </div>
      <ScrollArea className='h-[calc(100vh-435px)] rounded-md border'>
        <Table className='relative'>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <ScrollBar orientation='horizontal' />
      </ScrollArea>
    </>
  );
};
