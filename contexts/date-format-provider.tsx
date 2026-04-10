'use client';

import React, { createContext, useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { useFetch } from '@/hooks/use-fetch';
import type { UpdateUserPreferencesResponse } from '@/types';
import { availableDateFormatTypes, URL_CHANGE_PREFERENCES } from '@/utils/const';

export type DateFormatType =
  (typeof availableDateFormatTypes)[keyof typeof availableDateFormatTypes];

interface DateFormatContextType {
  dateFormat: DateFormatType;
  availableDateFormatTypes: typeof availableDateFormatTypes;
  changeDateFormat: (dateFormat: DateFormatType) => Promise<void>;
  setDateFormat: React.Dispatch<React.SetStateAction<DateFormatType>>;
}

export const DateFormatContext = createContext<DateFormatContextType | undefined>(undefined);

export const DateFormatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dateFormat, setDateFormat] = useState<DateFormatType>(availableDateFormatTypes.EU);
  const { fetchPetition } = useFetch();
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/user/preferences')
      .then(r => r.json())
      .then(data => {
        if (data?.dateFormat) setDateFormat(data.dateFormat as DateFormatType);
      })
      .catch(() => {});
  }, []);

  const changeDateFormat = async (newDateFormat: DateFormatType) => {
    setDateFormat(newDateFormat);
    const response = await fetchPetition<UpdateUserPreferencesResponse>({
      method: 'POST',
      url: URL_CHANGE_PREFERENCES,
      body: { dateFormat: newDateFormat },
    });
    if (response.error) {
      toast({
        title: 'Error updating preferences',
        description: response.error,
        variant: 'destructive',
      });
    }
  };

  const value = {
    dateFormat,
    changeDateFormat,
    setDateFormat,
    availableDateFormatTypes,
  };

  return <DateFormatContext.Provider value={value}>{children}</DateFormatContext.Provider>;
};
