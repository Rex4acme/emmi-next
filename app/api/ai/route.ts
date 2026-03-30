// app/api/ai/route.ts — EMMI AI Proxy
//
// PROVIDER CHAIN:
//   1. Groq llama-3.3-70b  — fastest, needs GROQ_API_KEY in Vercel env vars
//   2. Groq llama-3.1-8b   — fast fallback, same key
//   3. OpenRouter free      — needs OPENROUTER_API_KEY (free at openrouter.ai)
//   4. Pollinations AI      — no key, always available as last resort
//
// WHY AI WAS FAILING: GROQ_API_KEY was not set in Vercel environment variables.
// Fix: Go to Vercel → Project → Settings → Environment Variables → Add:
//   GROQ_API_KEY = (your key from console.groq.com — free)
//   OPENROUTER_API_KEY = (your key from openrouter.ai — free)

import { NextRequest, NextResponse } from 'next/server';

const EMMI_SYSTEM = `You are EMMI — an expert AI assistant for industrial electrical engineers with 20+ years of experience.
You specialise in: electrical fault diagnosis, power systems (HV/MV/LV), transformers, motors, switchgear, VFDs, 
industrial automation, DCS/SCADA, PLCs, preventive and corrective maintenance, Nigerian/West African industrial standards (NEMSA, SON, IEC, IEEE), 
and occupational safety (PTW, LOTO, arc flash, hot work).
Give precise, technical, practical answers. Use proper electrical engineering terminology.
Always flag safety implications for high-voltage or live-line work.
When asked to analyse a fault, respond with valid JSON only — no markdown, no preamble outside the JSON.`;

export async function POST(request: NextRequest) {
  let body: any = {};
  try { body = await request.json(); } catch {}

  const userMessages: any[] = body.messages || [];
  const systemPrompt: string = body.system || EMMI_SYSTEM;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...userMessages,
  ];

  // ── Provider chain ─────────────────────────────────────────
  const providers = [
    { name: 'Groq-70b',      fn: () => tryGroq(messages, 'llama-3.3-70b-versatile') },
    { name: 'Groq-8b',       fn: () => tryGroq(messages, 'llama-3.1-8b-instant')    },
    { name: 'OpenRouter',    fn: () => tryOpenRouter(messages)                        },
    { name: 'Pollinations',  fn: () => tryPollinations(userMessages, systemPrompt)    },
  ];

  for (const p of providers) {
    try {
      const result = await p.fn();
      if (result && result.trim().length > 10) {
        return NextResponse.json({ content: [{ type: 'text', text: result }] });
      }
    } catch (err) {
      console.error(`[EMMI AI] ${p.name} failed:`, err);
      continue;
    }
  }

  return NextResponse.json({
    content: [{
      type: 'text',
      text: 'AI assistant is temporarily unavailable. Please check your GROQ_API_KEY or OPENROUTER_API_KEY in environment variables, and ensure internet access.',
    }],
    ok: false,
    code: 'ai_unavailable',
  }, { status: 503 });
}

// ── Provider 1 & 2: Groq ──────────────────────────────────────
async function tryGroq(messages: any[], model: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, max_tokens: 2000, temperature: 0.4 }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Groq ${model}: ${e?.error?.message || res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

// ── Provider 3: OpenRouter (free models available) ────────────
async function tryOpenRouter(messages: any[]): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  // mistral-7b-instruct is free on OpenRouter
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${key}`,
      'HTTP-Referer':  'https://emmi-next.vercel.app',
      'X-Title':       'EMMI Engineering Assistant',
    },
    body: JSON.stringify({
      model:       'mistralai/mistral-7b-instruct:free',
      messages,
      max_tokens:  1500,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) throw new Error(`OpenRouter: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

// ── Provider 4: Pollinations AI (no key, always last resort) ──
async function tryPollinations(userMessages: any[], systemPrompt: string): Promise<string | null> {
  const lastMsg = userMessages.filter((m: any) => m.role === 'user').pop()?.content || '';
  if (!lastMsg) return null;

  const fullPrompt = `${systemPrompt}\n\nUser: ${lastMsg}\n\nAssistant:`;
  const encoded    = encodeURIComponent(fullPrompt);

  const res = await fetch(`https://text.pollinations.ai/${encoded}`, {
    method:  'GET',
    headers: { Accept: 'text/plain' },
    signal:  AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`Pollinations: ${res.status}`);
  const text = await res.text();
  return text?.trim() || null;
}

export async function GET() {
  return Response.json({ status: 'EMMI AI proxy — use POST' });
}