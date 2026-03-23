// app/api/ai/route.ts — AI Proxy with 4-level fallback chain
//
// REQUEST FLOW:
//   1. Pollinations AI  — no key, unlimited, free forever
//   2. Groq             — free key, 14,400 requests/day
//   3. Together AI      — free key, $1 free credit
//   4. OpenRouter       — free key, access to many free models
//
// The app automatically moves to the next provider if one fails.
// NO key is required for Pollinations — it always works as base layer.
// Add the other keys in Vercel env vars for extra reliability.

import { NextRequest, NextResponse } from 'next/server';

// ── Shared system prompt for EMMI ─────────────────────────────
const EMMI_SYSTEM = `You are EMMI, an expert AI assistant for electrical engineers. 
You specialise in electrical maintenance, fault diagnosis, equipment troubleshooting, 
DCS/SCADA systems, power systems, and industrial electrical engineering.
Give precise, technical, practical answers. Be concise but thorough.
When analysing faults, consider: root cause, safety implications, and corrective actions.`;

// ── Main handler ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const body        = await request.json().catch(() => ({}));
  const userMessages = body.messages || [];
  const systemPrompt = body.system || EMMI_SYSTEM;
  const userText     = userMessages.map((m: any) => m.content).join('\n');

  // Try each provider in order — move to next if current fails
  const providers = [
    () => tryPollinations(userText, systemPrompt),
    () => tryGroq(userText, systemPrompt),
    () => tryTogetherAI(userText, systemPrompt),
    () => tryOpenRouter(userText, systemPrompt),
  ];

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result) {
        return NextResponse.json({ content: [{ type: 'text', text: result }] });
      }
    } catch (err) {
      // This provider failed — silently try the next one
      console.error('Provider failed, trying next:', err);
      continue;
    }
  }

  // All providers failed — return friendly message
  return NextResponse.json({
    content: [{ type: 'text', text: 'AI is temporarily unavailable across all providers. Please try again in a few minutes.' }]
  });
}

// ── PROVIDER 1: Pollinations AI ───────────────────────────────
// No API key. No account. Unlimited. Always try this first.
async function tryPollinations(userText: string, systemPrompt: string): Promise<string | null> {
  const fullPrompt = `${systemPrompt}\n\nUser: ${userText}\n\nAssistant:`;
  const encoded    = encodeURIComponent(fullPrompt);

  const res = await fetch(`https://text.pollinations.ai/${encoded}`, {
    method:  'GET',
    headers: { Accept: 'text/plain' },
    signal:  AbortSignal.timeout(15000), // 15 second timeout
  });

  if (!res.ok) return null;

  const text = await res.text();
  return text.trim() || null;
}

// ── PROVIDER 2: Groq ──────────────────────────────────────────
// Free key at: console.groq.com — 14,400 requests/day free
// Add GROQ_API_KEY to Vercel environment variables
async function tryGroq(userText: string, systemPrompt: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null; // Skip if no key configured

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model:       'llama3-8b-8192', // Fast, free Llama 3 model on Groq
      messages:    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }],
      max_tokens:  1500,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

// ── PROVIDER 3: Together AI ───────────────────────────────────
// Free key at: api.together.xyz — $1 free credit, pay-as-you-go after
// Add TOGETHER_API_KEY to Vercel environment variables
async function tryTogetherAI(userText: string, systemPrompt: string): Promise<string | null> {
  const key = process.env.TOGETHER_API_KEY;
  if (!key) return null;

  const res = await fetch('https://api.together.xyz/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model:       'meta-llama/Llama-3-8b-chat-hf', // Free open-source model
      messages:    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }],
      max_tokens:  1500,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

// ── PROVIDER 4: OpenRouter ────────────────────────────────────
// Free key at: openrouter.ai — gateway to many free models
// Add OPENROUTER_API_KEY to Vercel environment variables
async function tryOpenRouter(userText: string, systemPrompt: string): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${key}`,
      'HTTP-Referer':  'https://emmi.app', // Required by OpenRouter
      'X-Title':       'EMMI Engineering Assistant',
    },
    body: JSON.stringify({
      model:       'meta-llama/llama-3-8b-instruct:free', // Free model on OpenRouter
      messages:    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }],
      max_tokens:  1500,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405 });
}
