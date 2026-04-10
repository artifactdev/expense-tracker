import { NextResponse } from 'next/server';

import { getUsersSubscriptions } from '@/services/user';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

export const GET = async () => {
  try {
    const subscriptions = await getUsersSubscriptions(LOCAL_USER_ID);
    return NextResponse.json({ ok: true, subscriptions }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : errorMessages.retrieveSubscriptions;
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};
