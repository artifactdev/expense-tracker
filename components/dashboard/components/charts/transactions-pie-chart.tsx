import { LoadingSpinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TransactionObjBack } from '@/types';
import {
  aggregateByParentCategory,
  aggregateTransactionsPerCategories,
  buildParentLookup,
  type CategoryNode,
} from '../../utils/aggregate-transactions-per-categories';
import { EXPENSES_CHART_COLOR, INCOMES_CHART_COLOR } from '../../utils/const';
import { PieChartBlock } from './pie-chart';

type Props = {
  filteredData: TransactionObjBack[] | undefined;
  isLoading: boolean;
  categories?: CategoryNode[];
};

export const TransactionsPieChart = ({ filteredData, isLoading, categories }: Props) => {
  const incomes = (filteredData ?? []).filter(trans => trans.amount >= 0);
  const expenses = (filteredData ?? []).filter(trans => trans.amount < 0);

  // Use parent-level aggregation when hierarchy is available
  const parentLookup = categories ? buildParentLookup(categories) : null;

  const expensesPerCategories = parentLookup
    ? aggregateByParentCategory(expenses, parentLookup)
    : aggregateTransactionsPerCategories({ transactions: expenses });

  const incomesPerCategories = parentLookup
    ? aggregateByParentCategory(incomes, parentLookup)
    : aggregateTransactionsPerCategories({ transactions: incomes });

  return isLoading ? (
    <div className='flex items-center justify-center pt-28'>
      <LoadingSpinner size={140} />
    </div>
  ) : !filteredData || filteredData.length === 0 ? (
    <div className='flex items-center justify-center pt-36'>
      <p className='text-lg font-semibold'>There is no data for the selected dates</p>
    </div>
  ) : (
    <Tabs defaultValue='expenses' className='w-full'>
      <TabsList className='absolute right-[24px] top-[14px]'>
        <TabsTrigger value='expenses'>Expenses</TabsTrigger>
        <TabsTrigger value='incomes'>Incomes</TabsTrigger>
      </TabsList>
      <TabsContent value='expenses'>
        <PieChartBlock data={expensesPerCategories} pieColor={EXPENSES_CHART_COLOR} />
      </TabsContent>
      <TabsContent value='incomes'>
        <PieChartBlock data={incomesPerCategories} pieColor={INCOMES_CHART_COLOR} />
      </TabsContent>
    </Tabs>
  );
};
