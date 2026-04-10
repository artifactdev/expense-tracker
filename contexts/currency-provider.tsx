'use client';

import React, { createContext, useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { useFetch } from '@/hooks/use-fetch';
import type { UpdateUserPreferencesResponse } from '@/types';
import { availableCurrency, URL_CHANGE_PREFERENCES } from '@/utils/const';

export type CurrencyType = (typeof availableCurrency)[keyof typeof availableCurrency];

interface CurrencyContextType {
  currency: CurrencyType;
  availableCurrency: typeof availableCurrency;
  changeCurrency: (currency: CurrencyType) => Promise<void>;
  setCurrency: React.Dispatch<React.SetStateAction<CurrencyType>>;
}

export const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrency] = useState<CurrencyType>(availableCurrency.EUR);
  const { fetchPetition } = useFetch();
  const { toast } = useToast();

  // Load persisted currency from the API on mount
  useEffect(() => {
    fetch('/api/user/preferences')
      .then(r => r.json())
      .then(data => {
        if (data?.currency) setCurrency(data.currency as CurrencyType);
      })
      .catch(() => {});
  }, []);

  const changeCurrency = async (newCurrency: CurrencyType) => {
    setCurrency(newCurrency);
    const response = await fetchPetition<UpdateUserPreferencesResponse>({
      method: 'POST',
      url: URL_CHANGE_PREFERENCES,
      body: { currency: newCurrency },
    });
    if (response.error) {
      toast({
        title: 'Error updating preferences',
        description: response.error,
        variant: 'destructive',
      });
    }
  };

  const value = { currency, changeCurrency, setCurrency, availableCurrency };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};
