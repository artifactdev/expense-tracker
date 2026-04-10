import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { UpdatePreferencesSchema } from '@/schemas/update-preferences-schema';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

type ReqObjI = {
  currency?: string;
  dateFormat?: string;
  theme?: string;
};

export const POST = async (req: NextRequest) => {
  const data = (await req.json()) as ReqObjI;

  try {
    UpdatePreferencesSchema.parse(data);

    const updatedUser = await prisma.user.update({
      where: { id: LOCAL_USER_ID },
      data: {
        ...(data.currency && { currency: data.currency }),
        ...(data.dateFormat && { dateFormat: data.dateFormat }),
        ...(data.theme && { theme: data.theme }),
      },
    });

    return NextResponse.json(
      { ok: true, updatedUser, message: 'Preferences successfully updated' },
      { status: 200 }
    );
  } catch (err) {
    console.log('ERROR UPDATING PREFERENCES', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: errorMessages.incorrectData }, { status: 400 });
    }
    const errorMessage = err instanceof Error ? err.message : errorMessages.updatingPreferences;
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};
