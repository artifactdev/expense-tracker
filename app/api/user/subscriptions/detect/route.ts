import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { enrichSubscriptionCandidates } from '@/services/ai';
import { LOCAL_USER_ID } from '@/utils/const';
import { detectSubscriptions } from '@/utils/detect-subscriptions';

// GET  → fast algorithmic detection only
// POST → AI enrichment for given candidates
export const GET = async () => {
  const transactions = await prisma.transaction.findMany({
    where: { userId: LOCAL_USER_ID },
    select: { id: true, name: true, amount: true, date: true, counterparty: true },
  });

  const algorithmic = detectSubscriptions(transactions);

  return NextResponse.json({
    ok: true,
    candidates: algorithmic.map(c => ({ ...c, aiConfidence: null, aiNotes: null })),
  });
};

export const POST = async (req: NextRequest) => {
  const { candidates } = (await req.json()) as {
    candidates: { name: string; amount: number; billingPeriod: string; occurrences: number }[];
  };

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, enriched: [] });
  }

  try {
    const aiCandidates = await enrichSubscriptionCandidates(candidates);
    if (aiCandidates) {
      return NextResponse.json({ ok: true, enriched: aiCandidates });
    }
  } catch {
    // AI failed
  }

  return NextResponse.json({
    ok: true,
    enriched: candidates.map(c => ({ ...c, aiConfidence: null, aiNotes: null })),
  });
};
