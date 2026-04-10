'use client';

import { useCallback, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarIcon } from '@radix-ui/react-icons';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Bot } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';

import { ClockLoader } from '@/components/icons/clock-loader';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { AISettings } from '@/schemas/update-ai-settings-schema';
import { TransactionFormValue, UpdateTransSchema } from '@/schemas/update-transactions-schema';
import type { Categories, TransactionObjBack } from '@/types';
import { dateFormat, URL_AI_SETTINGS, URL_AI_SUGGEST_CATEGORIES } from '@/utils/const';
import { CategoriesComboboxField } from '../categories-combobox-field';

type Props = {
  loading: boolean;
  initData?: TransactionObjBack;
  submitHandler: (data: TransactionFormValue) => void;
  onCancel: () => void;
  userCategories: Categories[];
  submitButtonContent?: string;
  cancelButtonContent?: string;
};

export const TransactionForm = ({
  submitHandler,
  onCancel,
  loading,
  initData,
  userCategories,
  submitButtonContent,
  cancelButtonContent,
}: Props) => {
  const [aiLoading, setAiLoading] = useState(false);

  const { data: aiSettings } = useQuery<AISettings>({
    queryKey: [URL_AI_SETTINGS],
    queryFn: async () => {
      const res = await fetch(URL_AI_SETTINGS);
      return res.json();
    },
  });

  const aiEnabled = aiSettings?.aiEnabled && aiSettings?.aiCategoriesEnabled;

  const defaultValues = {
    name: initData?.name ?? '',
    amount: initData?.amount ?? 0,
    date: initData?.date,
    categories: initData?.categories ?? [],
    notes: initData?.notes ?? '',
    counterparty: initData?.counterparty ?? '',
    account: initData?.account ?? '',
    paymentType: initData?.paymentType ?? '',
    id: initData?.id ?? 'new trans',
  };

  const form = useForm<TransactionFormValue>({
    resolver: zodResolver(UpdateTransSchema),
    defaultValues,
  });

  const { trigger } = form;

  const handleAISuggest = useCallback(async () => {
    const name = form.getValues('name');
    const amount = form.getValues('amount');
    if (!name) return;
    setAiLoading(true);
    try {
      const res = await fetch(URL_AI_SUGGEST_CATEGORIES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          amount,
          counterparty: form.getValues('counterparty'),
          notes: form.getValues('notes'),
        }),
      });
      const data: { ok: boolean; suggestions?: string[] } = await res.json();
      if (data.ok && data.suggestions && data.suggestions.length > 0) {
        const suggested: Categories[] = data.suggestions.map(s => {
          const existing = userCategories.find(c => c.name.toLowerCase() === s.toLowerCase());
          return existing ?? { id: crypto.randomUUID(), name: s, newEntry: true };
        });
        // AI returns [Parent, Child] — replace instead of merge
        form.setValue('categories', suggested.slice(0, 2), { shouldDirty: true });
      }
    } finally {
      setAiLoading(false);
    }
  }, [form, userCategories]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitHandler)} className='w-full space-y-2 pl-1 pr-3'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  type='text'
                  placeholder='Name eingeben...'
                  disabled={loading}
                  {...field}
                  onChange={e => {
                    field.onChange(e);
                    trigger(field.name);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='date'
          render={({ field }) => {
            const parsedDateValue =
              typeof field.value === 'string' ? new Date(field.value) : field.value;
            return (
              <FormItem className='flex flex-col'>
                <FormLabel>Datum</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className='mr-2 h-4 w-4' />
                        {field.value ? (
                          format(parsedDateValue, 'LLL dd, y')
                        ) : (
                          <span>Datum wählen</span>
                        )}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className='w-auto p-0' align='start'>
                    <Calendar
                      mode='single'
                      selected={parsedDateValue}
                      onSelect={date => field.onChange(date ? format(date, dateFormat.ISO) : date)}
                      defaultMonth={parsedDateValue}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        <FormItem>
          <div className='flex items-center justify-between'>
            <FormLabel>Kategorien</FormLabel>
            {aiEnabled && (
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={aiLoading || loading}
                onClick={handleAISuggest}
                className='h-6 gap-1 px-2 text-xs'
              >
                <Bot className='size-3' />
                {aiLoading ? 'Suggesting...' : 'AI suggest'}
              </Button>
            )}
          </div>
          <FormControl>
            <Controller
              control={form.control}
              name='categories'
              render={({ field, fieldState: { error } }) => (
                <>
                  <CategoriesComboboxField
                    selectedCategories={field.value as Categories[]}
                    userCats={userCategories}
                    updateSelectedCategories={selected => field.onChange(selected)}
                  />
                  {error && <FormMessage>{error.message}</FormMessage>}
                </>
              )}
            />
          </FormControl>
        </FormItem>
        <FormField
          control={form.control}
          name='amount'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Betrag</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  step='0.01'
                  placeholder='Betrag eingeben...'
                  disabled={loading}
                  {...field}
                  onChange={e => {
                    const parsedValue = parseFloat(e.target.value);
                    field.onChange(isNaN(parsedValue) ? '' : parsedValue);
                    trigger(field.name);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='notes'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notizen</FormLabel>
              <FormControl>
                <Input
                  type='text'
                  placeholder='Notizen...'
                  disabled={loading}
                  {...field}
                  onChange={e => {
                    field.onChange(e);
                    trigger(field.name);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='counterparty'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gegenpartei</FormLabel>
              <FormControl>
                <Input
                  type='text'
                  placeholder='Gegenpartei...'
                  disabled={loading}
                  {...field}
                  onChange={e => {
                    field.onChange(e);
                    trigger(field.name);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='account'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Konto</FormLabel>
              <FormControl>
                <Input
                  type='text'
                  placeholder='IBAN / Konto...'
                  disabled={loading}
                  {...field}
                  onChange={e => {
                    field.onChange(e);
                    trigger(field.name);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='paymentType'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zahlungsart</FormLabel>
              <FormControl>
                <Input
                  type='text'
                  placeholder='z.B. Lastschrift, Überweisung...'
                  disabled={loading}
                  {...field}
                  onChange={e => {
                    field.onChange(e);
                    trigger(field.name);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='flex w-full items-center justify-end space-x-2 pt-6'>
          <Button type='button' disabled={loading} variant='outline' onClick={onCancel}>
            {cancelButtonContent || 'Cancel'}
          </Button>
          <Button type='submit' disabled={loading} variant='default'>
            {loading && <ClockLoader className='mr-2' />}
            {submitButtonContent || 'Update'}
          </Button>
        </div>
      </form>
    </Form>
  );
};
