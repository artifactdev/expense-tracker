import { NextRequest, NextResponse } from 'next/server';

import { deleteSubscriptions } from '@/services/user';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

interface ReqObjI {
  subscriptionIds: string[];
}

export const DELETE = async (req: NextRequest) => {
  const data = (await req.json()) as ReqObjI;
  const { subscriptionIds } = data;

  try {
    const result = await deleteSubscriptions({
      userId: LOCAL_USER_ID,
      subscriptionIds,
    });

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    console.log('ERROR DELETING SUBSCRIPTION TO THE USER', err);
    const errorMessage = err instanceof Error ? err.message : errorMessages.deletingSubscriptions;
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};
