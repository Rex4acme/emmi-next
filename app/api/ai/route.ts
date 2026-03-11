// app/api/ai/route.ts — AI Proxy using Google Gemini (FREE tier)
// Gemini 2.0 Flash: free tier, no credit card needed
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

    // Combine system prompt + user messages into one prompt for Gemini
    const systemPrompt = body.system || '';
    const userMessages = body.messages || [];
    const userText = userMessages.map((m: any) => m.content).join('\n');
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userText}` : userText;

    // Call Gemini 2.0 Flash — free tier
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          maxOutputTokens: 1500,
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini error:', response.status, err);
      return NextResponse.json(
        { error: `Gemini API error (${response.status}): ${err.slice(0, 300)}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Extract text and format like Anthropic response so rest of app works unchanged
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return NextResponse.json({
      content: [{ type: 'text', text }]
    });

  } catch (err: any) {
    console.error('AI proxy error:', err);
    return NextResponse.json({ error: 'AI proxy error: ' + err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405 });
}
