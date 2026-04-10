import { NextRequest, NextResponse } from 'next/server';

import { updateUserTransactionsDate } from '@/services/user';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

type ReqObjI = {
  dates?: { from: string; to: string } | null;
};

export const POST = async (req: NextRequest) => {
  try {
    const data = (await req.json()) as ReqObjI;
    const { dates } = data;

    await updateUserTransactionsDate({
      userId: LOCAL_USER_ID,
      transactionsDate: dates ?? null,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : errorMessages.generic;
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};
