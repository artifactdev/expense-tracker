import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { CreateSubSchema } from '@/schemas/create-subscription-schema';
import { addSubscriptionToUser } from '@/services/user';
import type { EnhancedSubscription } from '@/types';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

interface ReqObjI {
  subscriptionData: EnhancedSubscription;
}

export const POST = async (req: NextRequest) => {
  const data = (await req.json()) as ReqObjI;
  const { subscriptionData } = data;

  try {
    CreateSubSchema.parse(subscriptionData);

    const parsedSubData = { ...subscriptionData };
    // @ts-expect-error deleting _id property
    delete parsedSubData._id;

    const newSubscription = await addSubscriptionToUser({
      userId: LOCAL_USER_ID,
      subscription: parsedSubData,
    });

    return NextResponse.json({ ok: true, subscription: newSubscription }, { status: 201 });
  } catch (err) {
    console.log('ERROR ADDING SUBSCRIPTION TO THE USER', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: errorMessages.incorrectSubscriptionData },
        { status: 400 }
      );
    }
    const errorMessage = err instanceof Error ? err.message : errorMessages.addingSubscription;
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};
