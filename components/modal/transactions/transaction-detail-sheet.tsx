'use client';

import { format } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useCurrency } from '@/hooks/use-currency';
import { useDateFormat } from '@/hooks/use-date-format';
import { cn } from '@/lib/utils';
import type { TransactionObjBack } from '@/types';
import { formatAmount } from '@/utils/format-amount';

interface TransactionDetailSheetProps {
  transaction: TransactionObjBack | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-1'>
      <span className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
        {label}
      </span>
      <div className='text-sm'>{children}</div>
    </div>
  );
}

export const TransactionDetailSheet = ({
  transaction,
  open,
  onOpenChange,
}: TransactionDetailSheetProps) => {
  const { currency } = useCurrency();
  const { dateFormat } = useDateFormat();

  if (!transaction) return null;

  const amount = transaction.amount;
  const isIncome = amount >= 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='w-full sm:max-w-md' title='Transaktionsdetails'>
        <SheetHeader className='pb-4'>
          <SheetTitle className='text-lg'>Transaktionsdetails</SheetTitle>
          <SheetDescription className='sr-only'>
            Details zur ausgewählten Transaktion
          </SheetDescription>
        </SheetHeader>

        <div className='space-y-6 overflow-y-auto px-1'>
          {/* Amount hero */}
          <div className='rounded-lg border bg-muted/30 p-4 text-center'>
            <p
              className={cn(
                'text-3xl font-bold tabular-nums',
                isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}
            >
              {isIncome ? '+' : ''}
              {formatAmount(amount)} {currency}
            </p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {format(new Date(transaction.date), dateFormat)}
            </p>
          </div>

          <Separator />

          {/* Details grid */}
          <div className='space-y-4'>
            <DetailRow label='Betreff'>
              <p className='font-medium'>{transaction.name}</p>
            </DetailRow>

            {transaction.counterparty && (
              <DetailRow label='Gegenpartei'>
                <p className='font-medium'>{transaction.counterparty}</p>
              </DetailRow>
            )}

            {transaction.paymentType && (
              <DetailRow label='Zahlungsart'>
                <Badge variant='outline'>{transaction.paymentType}</Badge>
              </DetailRow>
            )}

            {transaction.account && (
              <DetailRow label='Konto'>
                <code className='rounded bg-muted px-2 py-0.5 font-mono text-xs'>
                  {transaction.account}
                </code>
              </DetailRow>
            )}

            <DetailRow label='Kategorien'>
              <div className='flex flex-wrap gap-1.5'>
                {transaction.categories.map(cat => (
                  <Badge key={cat.id} variant='secondary'>
                    {cat.name}
                  </Badge>
                ))}
              </div>
            </DetailRow>

            {transaction.notes && (
              <DetailRow label='Notizen'>
                <p className='whitespace-pre-wrap text-muted-foreground'>{transaction.notes}</p>
              </DetailRow>
            )}
          </div>

          <Separator />

          {/* Metadata */}
          <div className='space-y-2 text-xs text-muted-foreground'>
            <div className='flex justify-between'>
              <span>Erstellt</span>
              <span>{format(new Date(transaction.createdAt), 'dd.MM.yyyy HH:mm')}</span>
            </div>
            <div className='flex justify-between'>
              <span>Aktualisiert</span>
              <span>{format(new Date(transaction.updatedAt), 'dd.MM.yyyy HH:mm')}</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
