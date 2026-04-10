import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { UpdateAISettingsSchema } from '@/schemas/update-ai-settings-schema';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

export const GET = async () => {
  const user = await prisma.user.findUnique({
    where: { id: LOCAL_USER_ID },
    select: {
      aiEnabled: true,
      aiCategoriesEnabled: true,
      aiSubscriptionDetection: true,
      aiEndpoint: true,
      aiModel: true,
      aiApiKey: true,
      aiSystemPrompt: true,
      aiMaxTokens: true,
    },
  });

  return NextResponse.json(
    user ?? {
      aiEnabled: false,
      aiCategoriesEnabled: false,
      aiSubscriptionDetection: false,
      aiEndpoint: null,
      aiModel: null,
      aiApiKey: null,
      aiSystemPrompt: null,
      aiMaxTokens: null,
    }
  );
};

export const POST = async (req: NextRequest) => {
  const data = await req.json();

  try {
    const parsed = UpdateAISettingsSchema.parse(data);

    const updatedUser = await prisma.user.update({
      where: { id: LOCAL_USER_ID },
      data: {
        ...(parsed.aiEnabled !== undefined && { aiEnabled: parsed.aiEnabled }),
        ...(parsed.aiCategoriesEnabled !== undefined && {
          aiCategoriesEnabled: parsed.aiCategoriesEnabled,
        }),
        ...(parsed.aiSubscriptionDetection !== undefined && {
          aiSubscriptionDetection: parsed.aiSubscriptionDetection,
        }),
        ...(parsed.aiEndpoint !== undefined && {
          aiEndpoint: parsed.aiEndpoint || null,
        }),
        ...(parsed.aiModel !== undefined && { aiModel: parsed.aiModel || null }),
        ...(parsed.aiApiKey !== undefined && {
          aiApiKey: parsed.aiApiKey || null,
        }),
        ...(parsed.aiSystemPrompt !== undefined && {
          aiSystemPrompt: parsed.aiSystemPrompt || null,
        }),
        ...(parsed.aiMaxTokens !== undefined && {
          aiMaxTokens: parsed.aiMaxTokens,
        }),
      },
    });

    return NextResponse.json(
      { ok: true, updatedUser, message: 'AI settings successfully updated' },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: errorMessages.incorrectData }, { status: 400 });
    }
    const errorMessage = err instanceof Error ? err.message : errorMessages.generic;
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};
