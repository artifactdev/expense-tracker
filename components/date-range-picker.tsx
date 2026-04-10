'use client';

import * as React from 'react';

import { CalendarIcon } from '@radix-ui/react-icons';
import { endOfMonth, format, startOfMonth, startOfYear, subMonths, subYears } from 'date-fns';
import { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DEVICE_TYPE } from '@/types/device';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  setDate: (e: DateRange | undefined) => void;
  viewport?: string;
}

const QUICK_RANGES = [
  {
    label: 'Dieser Monat',
    range: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
  },
  {
    label: 'Letzter Monat',
    range: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  {
    label: 'Letztes Jahr',
    range: () => ({
      from: startOfYear(subYears(new Date(), 1)),
      to: new Date(subYears(new Date(), 1).getFullYear(), 11, 31),
    }),
  },
];

export function CalendarDateRangePicker({ date, setDate, className, viewport }: Props) {
  const [open, setOpen] = React.useState(false);

  const handleQuickSelect = (range: () => DateRange) => {
    setDate(range());
    setOpen(false);
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id='date'
            variant={'outline'}
            className={cn(
              'w-[260px] justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className='mr-2 h-4 w-4' />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd, y')} &ndash; {format(date.to, 'LLL dd, y')}
                </>
              ) : (
                format(date.from, 'LLL dd, y')
              )
            ) : (
              <span>Alle Transaktionen</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='end'>
          <div className='flex'>
            {/* Quick-select sidebar */}
            <div className='flex min-w-[130px] flex-col justify-center gap-1 border-r p-2'>
              {QUICK_RANGES.map(q => (
                <Button
                  key={q.label}
                  variant='ghost'
                  size='sm'
                  className='justify-start text-xs'
                  onClick={() => handleQuickSelect(q.range)}
                >
                  {q.label}
                </Button>
              ))}
              <Button
                variant='ghost'
                size='sm'
                className='justify-start text-xs text-muted-foreground'
                onClick={() => {
                  setDate(undefined);
                  setOpen(false);
                }}
              >
                Alle anzeigen
              </Button>
            </div>
            {/* Calendar */}
            <div className='flex flex-col'>
              <Calendar
                initialFocus
                mode='range'
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={viewport === DEVICE_TYPE.mobile ? 1 : 2}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
