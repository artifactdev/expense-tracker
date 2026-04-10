import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { ChangeNameSchema } from '@/schemas/change-name-schema';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

type ReqObjI = {
  name: string;
};

export const POST = async (req: NextRequest) => {
  const data = (await req.json()) as ReqObjI;

  try {
    ChangeNameSchema.parse({ name: data.name });

    await prisma.user.update({
      where: { id: LOCAL_USER_ID },
      data: { name: data.name },
    });

    return NextResponse.json(
      { ok: true, message: `Name has been changed successfully to ${data.name}` },
      { status: 200 }
    );
  } catch (err) {
    console.log('ERROR CHANGING THE NAME', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: errorMessages.incorrectData }, { status: 400 });
    }
    const errorMessage = err instanceof Error ? err.message : errorMessages.changeName;
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};
