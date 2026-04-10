import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { enrichSubscriptionCandidates } from '@/services/ai';
import { LOCAL_USER_ID } from '@/utils/const';
import { detectSubscriptions } from '@/utils/detect-subscriptions';

export const GET = async () => {
  const transactions = await prisma.transaction.findMany({
    where: { userId: LOCAL_USER_ID },
    select: { id: true, name: true, amount: true, date: true },
  });

  const algorithmic = detectSubscriptions(transactions);

  if (algorithmic.length === 0) {
    return NextResponse.json({ ok: true, candidates: [] });
  }

  // Try AI enrichment (no-op if AI disabled)
  try {
    const aiCandidates = await enrichSubscriptionCandidates(
      algorithmic.map(c => ({
        name: c.name,
        amount: c.amount,
        billingPeriod: c.billingPeriod,
        occurrences: c.occurrences,
      }))
    );

    if (aiCandidates) {
      const enriched = algorithmic.map((c, i) => ({
        ...c,
        aiConfidence: aiCandidates[i]?.aiConfidence ?? null,
        aiNotes: aiCandidates[i]?.aiNotes ?? null,
      }));
      return NextResponse.json({ ok: true, candidates: enriched });
    }
  } catch {
    // AI failed — fall back to algorithmic only
  }

  return NextResponse.json({
    ok: true,
    candidates: algorithmic.map(c => ({ ...c, aiConfidence: null, aiNotes: null })),
  });
};
