'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ChangeNameBlock } from './change-name-block';
import { ChangePreferencesBlock } from './change-preferences-block';

interface AccordionData {
  key: string;
  title: string;
  data: React.ReactNode;
}

interface AccordionBlockProps {
  userId: string;
}

export const AccordionBlock = ({ userId }: AccordionBlockProps) => {
  const [accordionValue, setAccordionValue] = useState<string>('');

  const resetAccordion = useCallback(() => setAccordionValue(''), [setAccordionValue]);

  const accordionData: AccordionData[] = useMemo(
    () => [
      {
        key: 'change-name',
        title: 'Change Name',
        data: (
          <div className='mx-auto max-w-sm py-4'>
            <ChangeNameBlock userId={userId} />
          </div>
        ),
      },
      {
        key: 'change-preferences',
        title: 'Change Preferences',
        data: (
          <div className='mx-auto max-w-sm py-4 xl:max-w-full'>
            <ChangePreferencesBlock resetAccordion={resetAccordion} />
          </div>
        ),
      },
    ],
    [userId, resetAccordion]
  );

  return (
    <Accordion
      onValueChange={e => setAccordionValue(e)}
      type='single'
      collapsible
      className='w-full'
      value={accordionValue}
    >
      {accordionData.map(accordion => (
        <AccordionItem key={accordion.key} value={accordion.key}>
          <AccordionTrigger>{accordion.title}</AccordionTrigger>
          <AccordionContent>{accordion.data}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};
