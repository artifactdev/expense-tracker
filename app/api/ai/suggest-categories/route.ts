import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { suggestCategories } from '@/services/ai';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

export const POST = async (req: NextRequest) => {
  const body = await req.json();
  const { name, amount, counterparty, notes } = body as {
    name?: string;
    amount?: number;
    counterparty?: string;
    notes?: string;
  };

  if (!name || amount === undefined) {
    return NextResponse.json({ ok: false, error: errorMessages.missingData }, { status: 400 });
  }

  // Load existing user category names for context
  const userCats = await prisma.userCategory.findMany({
    where: { userId: LOCAL_USER_ID },
    include: { category: true },
  });
  const existingCategories = userCats.map(uc => uc.category.name);

  try {
    const result = await suggestCategories(name, amount, existingCategories, counterparty, notes);
    if (!result) {
      return NextResponse.json(
        { ok: false, error: errorMessages.aiNotConfigured },
        { status: 503 }
      );
    }
    if (result.suggestions.length === 0) {
      return NextResponse.json({ ok: true, suggestions: [] });
    }
    return NextResponse.json({ ok: true, suggestions: result.suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : errorMessages.aiRequestFailed;
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
};
