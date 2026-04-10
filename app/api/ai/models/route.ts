import { NextRequest, NextResponse } from 'next/server';

import { getAISettings } from '@/services/ai';

/**
 * GET  /api/ai/models            — uses saved DB settings
 * POST /api/ai/models { endpoint, apiKey } — uses provided values (pre-save preview)
 */

async function fetchModels(endpoint: string, apiKey?: string | null): Promise<string[]> {
  const base = endpoint.replace(/\/$/, '');
  const url = `${base}/models`;

  const headers: Record<string, string> = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Models endpoint returned ${res.status}`);

  const json = await res.json();

  // OpenAI format: { data: [{ id }] }
  if (Array.isArray(json.data)) {
    return json.data
      .map((m: { id?: string }) => m.id)
      .filter(Boolean)
      .sort() as string[];
  }
  // Ollama format: { models: [{ name }] }
  if (Array.isArray(json.models)) {
    return json.models
      .map((m: { name?: string; model?: string }) => m.name ?? m.model)
      .filter(Boolean)
      .sort() as string[];
  }
  return [];
}

export async function GET() {
  try {
    const settings = await getAISettings();
    if (!settings.aiEndpoint) {
      return NextResponse.json({ ok: false, error: 'No endpoint configured' }, { status: 400 });
    }
    const models = await fetchModels(settings.aiEndpoint, settings.aiApiKey);
    return NextResponse.json({ ok: true, models });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to fetch models' },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const endpoint: string | undefined = body.endpoint;
    const apiKey: string | undefined = body.apiKey;

    if (!endpoint) {
      return NextResponse.json({ ok: false, error: 'endpoint is required' }, { status: 400 });
    }

    const models = await fetchModels(endpoint, apiKey);
    return NextResponse.json({ ok: true, models });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to fetch models' },
      { status: 502 }
    );
  }
}
