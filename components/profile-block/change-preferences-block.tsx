'use client';

import { useMemo, useState } from 'react';

import { useTheme } from 'next-themes';

import { CurrencyType } from '@/contexts/currency-provider';
import { DateFormatType } from '@/contexts/date-format-provider';
import { useCurrency } from '@/hooks/use-currency';
import { useDateFormat } from '@/hooks/use-date-format';
import { useFetch } from '@/hooks/use-fetch';
import { UpdatePreferencesFormValue } from '@/schemas/update-preferences-schema';
import type { UpdateUserPreferencesResponse } from '@/types';
import {
  availableCurrency,
  availableDateFormatTypes,
  themeOptions,
  URL_CHANGE_PREFERENCES,
} from '@/utils/const';
import { ChangeUserPreferencesForm } from '../forms/user-preferences-form/change-user-preferences-form';
import { useToast } from '../ui/use-toast';

interface ChangePreferencesBlockProps {
  resetAccordion: () => void;
}

export interface DropdownData {
  key: keyof UpdatePreferencesFormValue;
  label: string;
  placeholder: string;
  options: { label: string; value: string }[];
}

const parsedAvailableCurrency = Object.entries(availableCurrency).map(([key, value]) => ({
  label: `${key} (${value})`,
  value,
}));

const parsedAvailableDateFormatTypes = Object.entries(availableDateFormatTypes).map(
  ([key, value]) => ({ label: `${key} (${value})`, value: value })
);

const parsedThemeOptions = themeOptions.map(themeOpt => ({
  label: themeOpt.name,
  value: themeOpt.key,
}));

const dropdownsData: DropdownData[] = [
  {
    key: 'dateFormat',
    label: 'Date Format',
    placeholder: 'Select the date format you want to use',
    options: parsedAvailableDateFormatTypes,
  },
  {
    key: 'currency',
    label: 'Currency',
    placeholder: 'Select the currency you want to use',
    options: parsedAvailableCurrency,
  },
  {
    key: 'theme',
    label: 'Theme',
    placeholder: 'Select the theme you want to use',
    options: parsedThemeOptions,
  },
];

export const ChangePreferencesBlock = ({ resetAccordion }: ChangePreferencesBlockProps) => {
  const { setTheme, theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { fetchPetition } = useFetch();
  const { dateFormat, setDateFormat } = useDateFormat();
  const { currency, setCurrency } = useCurrency();

  const defaultValues = useMemo(
    () => ({ theme, dateFormat, currency }),
    [theme, dateFormat, currency]
  );

  const onSubmit = async (data: UpdatePreferencesFormValue) => {
    setIsLoading(true);
    const response = await fetchPetition<UpdateUserPreferencesResponse>({
      method: 'POST',
      url: URL_CHANGE_PREFERENCES,
      body: { ...data },
    });

    if (response.error) {
      toast({
        title: 'Error changing the preferences',
        description: response.error,
        variant: 'destructive',
      });
    } else if (response.message) {
      if (data.dateFormat) {
        setDateFormat(data.dateFormat as DateFormatType);
      }
      if (data.currency) {
        setCurrency(data.currency as CurrencyType);
      }
      if (data.theme) {
        setTheme(data.theme);
      }
      toast({
        title: 'Preferences changed successfully',
        description: response.message,
        variant: 'success',
      });
      resetAccordion();
    }
    setIsLoading(false);
  };

  return (
    <div>
      <p className='pb-4 text-muted-foreground xl:mx-auto xl:max-w-[811px]'>
        This changes take effect immediately
      </p>
      <ChangeUserPreferencesForm
        dropdownsData={dropdownsData}
        onSubmit={onSubmit}
        isLoading={isLoading}
        defaultValues={defaultValues}
      />
    </div>
  );
};
