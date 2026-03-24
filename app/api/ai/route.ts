// app/api/ai/route.ts — EMMI AI Proxy
//
// PROVIDER ORDER (fastest/best first):
//   1. Groq (llama-3.3-70b-versatile) — PRIMARY — blazing fast, free key
//   2. Groq (llama-3.1-8b-instant)    — GROQ FALLBACK — ultra fast if 70b rate-limited
//   3. Pollinations AI                 — FINAL FALLBACK — no key, always available
//
// To enable: Add GROQ_API_KEY to Vercel → Settings → Environment Variables
// Get free key at: console.groq.com (free, no credit card)
// Free tier: 14,400 requests/day on 70b, 14,400/day on 8b

import { NextRequest, NextResponse } from 'next/server';

const EMMI_SYSTEM = `You are EMMI — an expert AI assistant for industrial electrical engineers with 20+ years of experience in:
- Electrical fault diagnosis and root cause analysis
- Power systems (HV/MV/LV), transformers, motors, switchgear, VFDs
- Industrial automation, DCS/SCADA, PLCs
- Preventive and corrective maintenance planning
- Nigerian/West African industrial plant standards (NEMSA, SON, IEC, IEEE)
- Occupational safety (PTW, LOTO, arc flash, hot work)

Give precise, technical, practical answers. Use proper electrical engineering terminology.
Always flag safety implications for high-voltage or live-line work.
When asked to analyse a fault, structure your response as valid JSON only — no markdown, no preamble.`;

export async function POST(request: NextRequest) {
  const body        = await request.json().catch(() => ({}));
  const userMessages = body.messages || [];
  const systemPrompt = body.system   || EMMI_SYSTEM;

  // Pass full conversation history to Groq for memory
  const messages = [
    { role: 'system', content: systemPrompt },
    ...userMessages,
  ];

  // Provider chain — tries each in order
  const providers = [
    () => tryGroq(messages, 'llama-3.3-70b-versatile'),   // Best quality
    () => tryGroq(messages, 'llama-3.1-8b-instant'),      // Fast fallback
    () => tryPollinations(userMessages, systemPrompt),    // No-key fallback
  ];

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result) {
        return NextResponse.json({
          content: [{ type: 'text', text: result }],
        });
      }
    } catch (err) {
      console.error('AI provider failed, trying next:', err);
      continue;
    }
  }

  return NextResponse.json({
    content: [{ type: 'text', text: 'AI is temporarily unavailable. Please try again in a moment.' }],
  });
}

// ── PROVIDER 1 & 2: Groq ─────────────────────────────────────
// OpenAI-compatible endpoint — supports full conversation history
async function tryGroq(
  messages: { role: string; content: string }[],
  model: string
): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens:  2000,
      temperature: 0.4,  // Lower = more precise/factual for engineering
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`Groq ${model} error:`, err);
    return null;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

// ── PROVIDER 3: Pollinations (no key, always available) ───────
async function tryPollinations(
  userMessages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string | null> {
  const lastUserMsg = userMessages.filter(m => m.role === 'user').pop()?.content || '';
  const fullPrompt  = `${systemPrompt}\n\nUser: ${lastUserMsg}\n\nAssistant:`;
  const encoded     = encodeURIComponent(fullPrompt);

  const res = await fetch(`https://text.pollinations.ai/${encoded}`, {
    method:  'GET',
    headers: { Accept: 'text/plain' },
    signal:  AbortSignal.timeout(15000),
  });

  if (!res.ok) return null;
  const text = await res.text();
  return text.trim() || null;
}

export async function GET() {
  return NextResponse.json({ status: 'EMMI AI proxy running. Use POST.' });
}