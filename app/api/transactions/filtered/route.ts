import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { FilteredTransactionsSchema } from '@/schemas/filtered-transactions-schema';
import { getFilteredTransactions } from '@/services/transactions';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';
import { parseZodErrors } from '@/utils/parse-zod-errors';

export const GET = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const transType = searchParams.get('transType');
    const filterType = searchParams.get('filterType');
    const filterOperator = searchParams.get('filterOperator');
    const filterValue = searchParams.get('filterValue');
    const filteredCategories = searchParams.get('categories')?.split(',');

    const parsedParams = FilteredTransactionsSchema.safeParse({
      userId: LOCAL_USER_ID,
      startDate,
      endDate,
      transType,
      filterType,
      filterOperator,
      filterValue,
      filteredCategories,
    });

    if (!parsedParams.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parseZodErrors({ error: parsedParams.error }),
          data: null,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(await getFilteredTransactions(parsedParams.data), {
      status: 200,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: parseZodErrors({ error }), data: null },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: errorMessages.generic, data: null },
      { status: 500 }
    );
  }
};
