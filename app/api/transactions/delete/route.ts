import { NextRequest, NextResponse } from 'next/server';

import { deleteTransactionsInBulk } from '@/services/transactions';
import { Categories } from '@/types';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

interface ReqBody {
  transactions: { transactionIds: string; categoriesId: Categories[] }[];
}

export const DELETE = async (req: NextRequest) => {
  try {
    const { transactions } = (await req.json()) as ReqBody;
    const result = await deleteTransactionsInBulk({
      userId: LOCAL_USER_ID,
      transactions,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.log('ERROR DELETING TRANSACTIONS', err);
    return NextResponse.json(
      { ok: false, error: errorMessages.deletingTransactions },
      { status: 500 }
    );
  }
};
