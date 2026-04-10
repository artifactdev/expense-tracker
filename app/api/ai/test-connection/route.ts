import { NextRequest, NextResponse } from 'next/server';

import { getAISettings } from '@/services/ai';

/**
 * POST /api/ai/test-connection
 * Body (all optional — falls back to saved DB settings):
 *   { endpoint?: string; apiKey?: string; model?: string }
 *
 * Sends a minimal chat completion request and measures latency.
 */
export async function POST(request: NextRequest) {
  const start = Date.now();

  let endpoint: string | null = null;
  let apiKey: string | null = null;
  let model: string | null = null;

  try {
    const body = await request.json().catch(() => ({}));

    // Prefer explicit body values, fall back to DB
    if (body.endpoint || body.apiKey || body.model) {
      endpoint = body.endpoint ?? null;
      apiKey = body.apiKey ?? null;
      model = body.model ?? null;
    } else {
      const settings = await getAISettings();
      endpoint = settings.aiEndpoint;
      apiKey = settings.aiApiKey;
      model = settings.aiModel;
    }

    if (!endpoint) {
      return NextResponse.json({ ok: false, error: 'No endpoint configured' }, { status: 400 });
    }
    if (!model) {
      return NextResponse.json({ ok: false, error: 'No model configured' }, { status: 400 });
    }

    const base = endpoint.replace(/\/$/, '');
    const url = `${base}/chat/completions`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
        max_tokens: 5,
        temperature: 0,
      }),
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        {
          ok: false,
          error: `Endpoint returned ${res.status}${text ? ': ' + text.slice(0, 200) : ''}`,
          latencyMs,
        },
        { status: 200 } // always 200 so the client gets the error detail
      );
    }

    const json = await res.json();
    const reply = (json.choices?.[0]?.message?.content as string | undefined)?.trim() ?? '';

    return NextResponse.json({
      ok: true,
      latencyMs,
      model,
      reply,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Connection failed',
      latencyMs: Date.now() - start,
    });
  }
}
