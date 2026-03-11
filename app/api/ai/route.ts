// app/api/ai/route.ts — Next.js API Route: Anthropic AI Proxy
// This runs SERVER-SIDE on Vercel — the ANTHROPIC_API_KEY is never
// sent to the browser. The browser calls POST /api/ai and this
// function adds the secret key and forwards to Anthropic.

import { NextRequest, NextResponse } from 'next/server';

// ── POST /api/ai ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Read the Anthropic API key from server environment variables
  // Set this in Vercel: Project Settings → Environment Variables
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Key not set — return a clear error so you know what to fix
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set in environment variables. Add it in Vercel → Project Settings → Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    // Parse the request body from the browser
    const body = await request.json();

    // Validate that messages array exists
    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }

    // Forward the request to Anthropic's API
    // This is a server-to-server call — no CORS issues
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,         // Secret API key — server only
        'anthropic-version': '2023-06-01',   // Required Anthropic version header
      },
      body: JSON.stringify({
        model:      body.model      || 'claude-sonnet-4-5', // Default model
        max_tokens: body.max_tokens || 1500,
        system:     body.system,               // AI persona/instructions
        messages:   body.messages,             // Conversation messages
      }),
    });

    // If Anthropic returned an error, pass it through clearly
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[EMMI AI] Anthropic error:', response.status, errorText);
      return NextResponse.json(
        { error: `Anthropic API error (${response.status}): ${errorText.slice(0, 200)}` },
        { status: response.status }
      );
    }

    // Success — return Claude's response to the browser
    const data = await response.json();
    return NextResponse.json(data);

  } catch (err: any) {
    console.error('[EMMI AI] Proxy error:', err);
    return NextResponse.json(
      { error: 'AI proxy error: ' + (err.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

// Block GET requests — only POST is valid
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 });
}
