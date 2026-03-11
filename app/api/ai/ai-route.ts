// app/api/ai/route.ts — AI Proxy using Google Gemini (FREE tier)
// Gemini 1.5 Flash: 1,500 requests/day free, no credit card needed
// Get your free key at: aistudio.google.com -> Get API Key

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not set. Get a free key at aistudio.google.com and add it to Vercel environment variables.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    // Build the prompt — combine system + user messages into one
    const systemPrompt = body.system || '';
    const userMessages = body.messages || [];
    const userText = userMessages.map((m: any) => m.content).join('\n');
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userText}` : userText;

    // Call Gemini 1.5 Flash — completely free tier
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            maxOutputTokens: 1500,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Gemini error: ${err.slice(0, 200)}` }, { status: response.status });
    }

    const data = await response.json();

    // Extract text from Gemini response and format like Anthropic response
    // so the rest of the app doesn't need to change
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return NextResponse.json({
      content: [{ type: 'text', text }]
    });

  } catch (err: any) {
    return NextResponse.json({ error: 'AI proxy error: ' + err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405 });
}
