import { Undo2 } from 'lucide-react';
import Link from 'next/link';

import { AddTransactionsTab } from '@/components/add-transactions/add-transactions-tab';
import { buttonVariants } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getUserCategories } from '@/services/user';
import { LOCAL_USER_ID } from '@/utils/const';
import { BreadCrumbTransactions } from './bread-crumb-transactions';

export default async function AddTransactionsEntryPoint() {
  const userCategories = await getUserCategories(LOCAL_USER_ID);

  return (
    <div className='flex-1 space-y-2 p-4 pt-6 sm:space-y-4 md:p-8'>
      <BreadCrumbTransactions />

      <div className='flex items-start justify-between'>
        <Heading
          maxWidthClass='max-w-[calc(100%-180px)]'
          title='Add transactions'
          description='Add transactions autommatically via CSV or manually'
        />
        <Link href={'/dashboard/transactions/list'} className={cn(buttonVariants())}>
          <Undo2 className='mr-2 h-4 w-4' /> Go back to the list
        </Link>
      </div>
      <Separator />
      <AddTransactionsTab userCategories={userCategories} />
    </div>
  );
}
