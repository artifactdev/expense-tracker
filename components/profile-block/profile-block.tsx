'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { LOCAL_USER_ID } from '@/utils/const';
import { AccordionBlock } from './accordion-block';

interface ProfileBlockProps {
  user?: { id: string; name: string | null } | null;
}

export const ProfileBlock = ({ user }: ProfileBlockProps) => {
  return (
    <ScrollArea className='h-[calc(100vh-250px)]'>
      <AccordionBlock userId={user?.id ?? LOCAL_USER_ID} />
    </ScrollArea>
  );
};
