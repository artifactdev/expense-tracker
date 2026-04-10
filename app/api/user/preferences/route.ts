import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { LOCAL_USER_ID } from '@/utils/const';

export const GET = async () => {
  const user = await prisma.user.findUnique({
    where: { id: LOCAL_USER_ID },
    select: { currency: true, dateFormat: true, theme: true },
  });
  return NextResponse.json(user ?? { currency: 'EUR', dateFormat: 'EU', theme: 'system' });
};
