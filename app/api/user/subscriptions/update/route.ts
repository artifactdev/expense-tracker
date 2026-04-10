import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { CreateSubSchema } from '@/schemas/create-subscription-schema';
import { updateSubscription } from '@/services/user';
import type { EnhancedSubscription } from '@/types';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

interface ReqObjI {
  subscriptionData: EnhancedSubscription;
}

export const PUT = async (req: NextRequest) => {
  const data = (await req.json()) as ReqObjI;
  const { subscriptionData } = data;

  try {
    CreateSubSchema.parse(subscriptionData);

    const result = await updateSubscription({
      userId: LOCAL_USER_ID,
      subscription: subscriptionData,
    });

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    console.log('ERROR UPDATING SUBSCRIPTION TO THE USER', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: errorMessages.incorrectSubscriptionData },
        { status: 400 }
      );
    }
    const errorMessage = err instanceof Error ? err.message : errorMessages.updateSubscription;
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};
