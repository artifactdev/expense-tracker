'use client';

import { useEffect, useMemo } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { type FilePondInitialFile } from 'filepond';
import { ArrowBigRightDash, Check, ChevronsUpDown, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandItem } from '@/components/ui/command';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddTransactionTable } from '@/hooks/use-add-transaction-table';
import { cn } from '@/lib/utils';
import {
  uploadCSVColumnsObject,
  UploadCSVColumnsSchema,
} from '@/schemas/upload-csv-columns-schema';
import { ResponseFile } from '@/types';
import {
  CSV_COLUMN_AUTODETECT,
  DATES_CSV_FORMAT_OPTIONS,
  MULTI_COLUMN_FIELDS,
  URL_UPLOAD_TRANSACTION_FILE,
} from '@/utils/const';
import { useToast } from '../../ui/use-toast';

type CSVColumnsDropdownProps = {
  files: (Blob | FilePondInitialFile | File)[];
  options: string[];
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  setCSVDateFormat: React.Dispatch<React.SetStateAction<string>>;
};

const FIELD_LABELS: Record<string, string> = {
  Concept: 'Description / Betreff',
  DateFormat: 'Date Format',
  CreditDebit: 'Credit/Debit Indicator',
  Counterparty: 'Counterparty / Auftraggeber',
  Account: 'Own Account (IBAN/Nr.)',
  PaymentType: 'Zahlungsart',
};

export const CSVColumnsDropdown = ({
  files,
  options,
  setCurrentStep,
  setCSVDateFormat,
}: CSVColumnsDropdownProps) => {
  const { toast } = useToast();
  const { setAddTransactions, userCategories, setUserCategories } = useAddTransactionTable();

  // Auto-detect: match CSV column names to field names
  // For multi-column fields, collect ALL matching columns into an array
  const autoDetectedDefaults = useMemo(() => {
    const defaults: Record<string, string | string[]> = {};
    for (const csvCol of options) {
      const fieldName = CSV_COLUMN_AUTODETECT[csvCol.toLowerCase()];
      if (!fieldName) continue;

      if (MULTI_COLUMN_FIELDS.has(fieldName)) {
        const current = defaults[fieldName];
        if (Array.isArray(current)) {
          current.push(csvCol);
        } else if (typeof current === 'string') {
          defaults[fieldName] = [current, csvCol];
        } else {
          defaults[fieldName] = [csvCol];
        }
      } else if (!defaults[fieldName]) {
        defaults[fieldName] = csvCol;
      }
    }
    return defaults;
  }, [options]);

  const form = useForm<z.infer<typeof UploadCSVColumnsSchema>>({
    resolver: zodResolver(UploadCSVColumnsSchema),
    defaultValues: autoDetectedDefaults,
  });

  useEffect(() => {
    const errFields = Object.keys(form.formState.errors);
    if (errFields.length > 0) {
      const parsedErrFields = errFields.map(field => FIELD_LABELS[field] ?? field);
      toast({
        title: 'Fill all the missing fields:',
        description: parsedErrFields.join(', '),
        variant: 'destructive',
      });
    }
  }, [form.formState.errors]);

  const onSubmit = async (values: z.infer<typeof UploadCSVColumnsSchema>) => {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // Multi-column fields: JSON-encode array
        formData.append(key, JSON.stringify(value));
      } else if (value !== undefined) {
        formData.append(key, value);
      }
    });
    (files as File[]).forEach(file => {
      formData.append('files', file);
    });
    const res = await fetch(URL_UPLOAD_TRANSACTION_FILE, {
      method: 'POST',
      body: formData,
    });
    const parsedRes = (await res.json()) as ResponseFile;
    if (parsedRes.error) {
      toast({
        title: 'There was an error retrieving the transactions',
        description: parsedRes.error,
        variant: 'destructive',
      });
      return;
    }
    if (parsedRes.data) {
      const modifiedTrans = parsedRes.data.map((trans, i) => ({
        ...trans,
        id: i,
      }));

      const categoryMap = new Map(userCategories.map(category => [category.id, category]));
      modifiedTrans.forEach(transaction => {
        transaction.selectedCategories?.forEach(category => {
          if (category.newEntry) {
            categoryMap.set(category.id, category);
          }
        });
      });
      const updatedUserCategories = Array.from(categoryMap.values());

      setUserCategories(updatedUserCategories);
      setAddTransactions(modifiedTrans);
      setCurrentStep(1);
      setCSVDateFormat(values.DateFormat);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormDescription>
          - Please ensure your CSV file starts directly with the column headers, followed by the
          data rows.
          <span className='font-bold'>
            {' '}
            Remove any introductory text, descriptions, or metadata
          </span>{' '}
          that banks often include at the top of the file. This step is crucial for a{' '}
          <span className='font-bold'>successful upload and processing of your file.</span>
        </FormDescription>
        <FormDescription>
          - Please <span className='font-bold'>identify the columns</span> in your CSV for{' '}
          <span className='font-bold'>Date, Description/Concept, Amount, Credit/Debit</span>, and{' '}
          <span className='font-bold'>Notes</span>, and select the{' '}
          <span className='font-bold'>date format</span>. Fields marked with{' '}
          <span className='font-bold'>(multi)</span> allow selecting multiple columns that will be
          combined.
        </FormDescription>
        <FormDescription className='mb-1'>
          - When uploading <span className='font-bold'>multiple files</span>, ensure they{' '}
          <span className='font-bold'>share identical columns/headers</span>. The system only
          evaluates the last uploaded file&apos;s structure for import accuracy.
        </FormDescription>
        <div className='grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3'>
          {Object.keys(uploadCSVColumnsObject).map(column => {
            const isMulti = MULTI_COLUMN_FIELDS.has(column);
            const label = FIELD_LABELS[column] ?? column;

            if (column === 'DateFormat') {
              return (
                <FormField
                  key={column}
                  control={form.control}
                  name={column}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select date format' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DATES_CSV_FORMAT_OPTIONS.map(dateFormatOption => (
                            <SelectItem key={dateFormatOption} value={dateFormatOption}>
                              {format(new Date(), dateFormatOption)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              );
            }

            if (isMulti) {
              return (
                <FormField
                  key={column}
                  control={form.control}
                  name={column}
                  render={({ field }) => {
                    const selected: string[] = Array.isArray(field.value)
                      ? field.value
                      : field.value
                        ? [field.value as string]
                        : [];

                    const toggleOption = (opt: string) => {
                      const next = selected.includes(opt)
                        ? selected.filter(s => s !== opt)
                        : [...selected, opt];
                      field.onChange(next);
                    };

                    return (
                      <FormItem>
                        <FormLabel>
                          {label} <span className='text-xs text-muted-foreground'>(multi)</span>
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant='outline'
                                role='combobox'
                                className='w-full justify-between truncate'
                              >
                                {selected.length > 0 ? selected.join(' + ') : `Select column(s)...`}
                                <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className='p-0' align='start'>
                            <Command>
                              {selected.length > 0 && (
                                <CommandGroup className='border-b'>
                                  <CommandItem
                                    onSelect={() => field.onChange([])}
                                    className='text-red-500'
                                  >
                                    <X className='mr-2 h-4 w-4' />
                                    Clear
                                  </CommandItem>
                                </CommandGroup>
                              )}
                              <ScrollArea maxHeight={200}>
                                <CommandGroup>
                                  {options.map(opt => (
                                    <CommandItem
                                      key={opt}
                                      value={opt}
                                      onSelect={() => toggleOption(opt)}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          selected.includes(opt) ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      {opt}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </ScrollArea>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </FormItem>
                    );
                  }}
                />
              );
            }

            // Single-select field
            return (
              <FormField
                key={column}
                control={form.control}
                name={column}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${label} column`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {options.map(option => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            );
          })}
        </div>
        <div className='my-2 mt-6 flex w-full sm:justify-center'>
          <Button className='w-full sm:w-[200px]' type='submit'>
            <ArrowBigRightDash className='mr-2 h-4 w-4' /> Go to next step
          </Button>
        </div>
      </form>
    </Form>
  );
};
