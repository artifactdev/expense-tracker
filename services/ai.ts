import { prisma } from '@/lib/prisma';
import type { AISettings } from '@/schemas/update-ai-settings-schema';
import { LOCAL_USER_ID } from '@/utils/const';

export const getAISettings = async (): Promise<AISettings> => {
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

  return (
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

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const callChatCompletion = async (
  settings: AISettings,
  messages: ChatMessage[]
): Promise<string | null> => {
  if (!settings.aiEnabled || !settings.aiEndpoint || !settings.aiModel) return null;

  const endpoint = settings.aiEndpoint.replace(/\/$/, '');
  const url = `${endpoint}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (settings.aiApiKey) {
    headers['Authorization'] = `Bearer ${settings.aiApiKey}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.aiModel,
      messages,
      temperature: 0.2,
      max_tokens: settings.aiMaxTokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI request failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  // Some reasoning models (e.g. Qwen3) put output in `reasoning` when content is null
  const content = (json.choices?.[0]?.message?.content as string | undefined | null) ?? null;
  const reasoning = (json.choices?.[0]?.message?.reasoning as string | undefined | null) ?? null;
  return content ?? reasoning ?? null;
};

// ---------------------------------------------------------------------------
// Suggest categories for a transaction
// ---------------------------------------------------------------------------

export type CategorySuggestionResult = {
  suggestions: string[];
};

export const suggestCategories = async (
  transactionName: string,
  amount: number,
  existingCategories: string[],
  counterparty?: string,
  notes?: string
): Promise<CategorySuggestionResult | null> => {
  const settings = await getAISettings();
  if (!settings.aiEnabled || !settings.aiEndpoint || !settings.aiModel) return null;

  const baseSystemPrompt = `You are a personal finance assistant. Your job is to assign categories to bank transactions.
Rules:
- ALWAYS prefer categories from the provided list. Only invent a new category name if none of the existing ones is even remotely suitable.
- NEVER return vague or meaningless categories like "Generic", "Other", "Miscellaneous", or "Unknown".
- Base your decision primarily on the payee/counterparty name and the transaction description, not just the amount.
- Return a JSON array of strings with 1–3 category names. Nothing else.
Example: ["Groceries", "Food"]`;

  const systemPrompt = settings.aiSystemPrompt
    ? `${settings.aiSystemPrompt}\n\n${baseSystemPrompt}`
    : baseSystemPrompt;

  const lines: string[] = [];
  if (counterparty) lines.push(`Payee/Counterparty: "${counterparty}"`);
  lines.push(`Transaction description: "${transactionName}"`);
  lines.push(`Amount: ${amount} (negative = expense, positive = income)`);
  if (notes) lines.push(`Notes: "${notes}"`);
  lines.push(
    `Available categories: ${existingCategories.length > 0 ? existingCategories.join(', ') : 'none yet'}`
  );
  lines.push(`\nReturn a JSON array with 1–3 category names from the list above.`);
  const userPrompt = lines.join('\n');

  const raw = await callChatCompletion(settings, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  if (!raw) return { suggestions: [] };

  // Strip reasoning blocks emitted by thinking models (e.g. Qwen, DeepSeek)
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  try {
    // Greedy match: find the LAST [...] array in the response
    const match = cleaned.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : cleaned);
    if (Array.isArray(parsed)) {
      return { suggestions: parsed.filter((s): s is string => typeof s === 'string').slice(0, 3) };
    }
  } catch {
    // non-parseable response
  }
  return { suggestions: [] };
};

// ---------------------------------------------------------------------------
// Detect subscriptions via AI (called after algorithmic pre-filter)
// ---------------------------------------------------------------------------

export type AlgorithmicCandidate = {
  name: string;
  amount: number;
  billingPeriod: string;
  occurrences: number;
};

export type AIEnrichedCandidate = AlgorithmicCandidate & {
  aiConfidence: number; // 0–1
  aiNotes: string;
};

export const enrichSubscriptionCandidates = async (
  candidates: AlgorithmicCandidate[]
): Promise<AIEnrichedCandidate[] | null> => {
  const settings = await getAISettings();
  if (!settings.aiEnabled || !settings.aiSubscriptionDetection || candidates.length === 0)
    return null;

  const baseSystemPrompt = `You are a personal finance assistant. You receive a list of potential recurring subscriptions detected in bank transactions. For each candidate, give a confidence score (0.0 to 1.0) indicating how likely it is a real subscription (vs a loan repayment, salary, etc.) and a short note.
Respond only with a valid JSON array matching the input order. Each element: { "confidence": 0.95, "notes": "streaming service" }.`;

  const systemPrompt = settings.aiSystemPrompt
    ? `${settings.aiSystemPrompt}\n\n${baseSystemPrompt}`
    : baseSystemPrompt;

  const userPrompt = `Candidates:\n${JSON.stringify(
    candidates.map(c => ({
      name: c.name,
      amount: c.amount,
      billingPeriod: c.billingPeriod,
      occurrences: c.occurrences,
    }))
  )}`;

  const raw = await callChatCompletion(settings, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  if (!raw) return null;

  try {
    const match = raw.match(/\[.*\]/s);
    const parsed = JSON.parse(match ? match[0] : raw) as Array<{
      confidence: number;
      notes: string;
    }>;
    if (Array.isArray(parsed) && parsed.length === candidates.length) {
      return candidates.map((c, i) => ({
        ...c,
        aiConfidence: Math.max(0, Math.min(1, parsed[i]?.confidence ?? 0.5)),
        aiNotes: parsed[i]?.notes ?? '',
      }));
    }
  } catch {
    // non-parseable — return with default confidence
  }

  return candidates.map(c => ({ ...c, aiConfidence: 0.5, aiNotes: '' }));
};
