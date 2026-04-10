import { NextResponse } from 'next/server';

import { getUserCategories } from '@/services/user';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

export const GET = async () => {
  try {
    const categories = await getUserCategories(LOCAL_USER_ID);
    return NextResponse.json({ ok: true, categories }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : errorMessages.retrieveCategories;
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};
