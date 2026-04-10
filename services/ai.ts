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
// Build a compact category tree string for AI prompts
// ---------------------------------------------------------------------------

export type CategoryTreeItem = {
  id: string;
  name: string;
  parentId: string | null;
  children?: CategoryTreeItem[];
};

export const buildCategoryTree = (
  flatCategories: { id: string; name: string; parentId: string | null }[]
): CategoryTreeItem[] => {
  const parentCats = flatCategories.filter(c => !c.parentId);
  const childCats = flatCategories.filter(c => c.parentId);
  return parentCats.map(parent => ({
    ...parent,
    children: childCats.filter(c => c.parentId === parent.id),
  }));
};

export const formatCategoryTreeForPrompt = (tree: CategoryTreeItem[]): string => {
  return tree
    .map(parent => {
      const children = parent.children?.map(c => c.name).join(', ') ?? '';
      return children ? `${parent.name}: ${children}` : parent.name;
    })
    .join('\n');
};

// ---------------------------------------------------------------------------
// Base system prompt for categorization
// ---------------------------------------------------------------------------

const BASE_SYSTEM_PROMPT = `You are a personal finance assistant. You assign spending categories to bank transactions.
The categories are organized as: Parent > Child.

Rules:
- Return ["Parent", "Child"] when a fitting subcategory exists.
- Return ["Parent"] when only the parent category fits and no subcategory is appropriate.
- Categories describe WHAT was bought/spent, NOT who was paid. Never use payment providers (PayPal, Stripe, Klarna), retailers (Amazon, eBay, Zalando), or bank names.
- ALWAYS use categories from the provided tree. Only invent a name if nothing fits at all.
- NEVER return vague categories like "Sonstige", "Generic", "Other".`;

// ---------------------------------------------------------------------------
// Suggest categories for a single transaction
// ---------------------------------------------------------------------------

export type CategorySuggestionResult = {
  suggestions: string[];
};

export const suggestCategories = async (
  transactionName: string,
  amount: number,
  categoryTree: string,
  counterparty?: string,
  notes?: string
): Promise<CategorySuggestionResult | null> => {
  const settings = await getAISettings();
  if (!settings.aiEnabled || !settings.aiEndpoint || !settings.aiModel) return null;

  const systemPrompt = settings.aiSystemPrompt
    ? `${settings.aiSystemPrompt}\n\n${BASE_SYSTEM_PROMPT}`
    : BASE_SYSTEM_PROMPT;

  const lines: string[] = [];
  if (counterparty) lines.push(`Payee/Counterparty: "${counterparty}"`);
  lines.push(`Transaction: "${transactionName}"`);
  lines.push(`Amount: ${amount} (negative = expense, positive = income)`);
  if (notes) lines.push(`Notes: "${notes}"`);
  lines.push(`\nCategory tree:\n${categoryTree}`);
  lines.push(`\nReturn a JSON array: ["Parent", "Child"] or ["Parent"]. Nothing else.`);

  const raw = await callChatCompletion(settings, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: lines.join('\n') },
  ]);

  if (!raw) return { suggestions: [] };

  return { suggestions: parseAICategoryResponse(raw) };
};

// ---------------------------------------------------------------------------
// Batch: suggest categories for multiple transactions in one API call
// ---------------------------------------------------------------------------

export type BatchTransaction = {
  idx: number;
  name: string;
  amount: number;
  counterparty?: string | null;
  notes?: string | null;
};

export type BatchResult = Record<number, string[]>;

export const suggestCategoriesBatch = async (
  transactions: BatchTransaction[],
  categoryTree: string,
  settings?: AISettings
): Promise<BatchResult | null> => {
  const s = settings ?? (await getAISettings());
  if (!s.aiEnabled || !s.aiEndpoint || !s.aiModel) return null;

  const systemPrompt = s.aiSystemPrompt
    ? `${s.aiSystemPrompt}\n\n${BASE_SYSTEM_PROMPT}`
    : BASE_SYSTEM_PROMPT;

  const txLines = transactions
    .map(tx => {
      const parts = [`#${tx.idx}`];
      if (tx.counterparty) parts.push(`Payee: "${tx.counterparty}"`);
      parts.push(`"${tx.name}"`);
      parts.push(`${tx.amount}`);
      if (tx.notes) parts.push(`Notes: "${tx.notes}"`);
      return parts.join(' | ');
    })
    .join('\n');

  const userPrompt = `Category tree:\n${categoryTree}\n\nTransactions (# | Payee | Description | Amount):\n${txLines}\n\nReturn a JSON object mapping each # to its categories: { "1": ["Parent", "Child"], "2": ["Parent"], ... }. Nothing else.`;

  const raw = await callChatCompletion(s, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  if (!raw) return {};

  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : cleaned);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const result: BatchResult = {};
      for (const [key, value] of Object.entries(parsed)) {
        const idx = parseInt(key, 10);
        if (!isNaN(idx) && Array.isArray(value)) {
          result[idx] = (value as unknown[])
            .filter((s): s is string => typeof s === 'string')
            .slice(0, 2);
        }
      }
      return result;
    }
  } catch {
    // non-parseable
  }
  return {};
};

// ---------------------------------------------------------------------------
// Parse AI response for single-tx category suggestion
// ---------------------------------------------------------------------------

const parseAICategoryResponse = (raw: string): string[] => {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  try {
    const match = cleaned.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === 'string').slice(0, 2);
    }
  } catch {
    // non-parseable
  }
  return [];
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
    const match = raw.match(/\[[\s\S]*\]/);
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
