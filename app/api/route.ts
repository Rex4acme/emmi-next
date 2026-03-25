// app/api/nameplate/route.ts
// Reads equipment nameplate photos using Google Gemini Flash (free vision model).
// Extracts: name, manufacturer, model, serial number, voltage, power rating,
// frequency, RPM, IP rating, standards, and any other visible specs.
//
// Setup: Add GEMINI_API_KEY to Vercel environment variables.
// Get free key at: aistudio.google.com → Get API Key (free, no credit card)
// Free tier: 15 requests/min, 1500/day — enough for any plant.

import { NextRequest, NextResponse } from 'next/server';

const NAMEPLATE_PROMPT = `You are an expert electrical engineer reading an industrial equipment nameplate.
Extract ALL information visible on the nameplate and return ONLY valid JSON, no markdown, no explanation.

Return this structure (use null for anything not visible):
{
  "equipment_name": "type of equipment e.g. Induction Motor, Transformer, VFD, Circuit Breaker",
  "manufacturer": "manufacturer/brand name",
  "model": "model number or designation",
  "serial_number": "serial number",
  "voltage_rating": "voltage e.g. 415V, 11kV, 415/240V",
  "current_rating": "current in amps",
  "power_rating": "power in kW or kVA or HP",
  "frequency": "frequency in Hz",
  "speed_rpm": "speed in RPM (motors only)",
  "power_factor": "power factor",
  "efficiency": "efficiency percentage",
  "ip_rating": "IP protection rating e.g. IP55",
  "insulation_class": "insulation class e.g. Class F",
  "duty_cycle": "duty cycle e.g. S1 continuous",
  "standards": "applicable standards e.g. IEC 60034, BS 5000",
  "weight_kg": "weight if shown",
  "country_of_origin": "made in",
  "year_of_manufacture": "year if visible",
  "additional_specs": ["any other spec visible on the nameplate"],
  "confidence": "high | medium | low — how clearly you could read the nameplate",
  "notes": "any observations about the nameplate condition or readability"
}`;

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'Nameplate AI not configured. Add GEMINI_API_KEY to Vercel environment variables. Get a free key at aistudio.google.com'
      }, { status: 503 });
    }

    // Call Gemini Flash — supports image input, fast and free
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: NAMEPLATE_PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,    // low temperature = more precise extraction
            maxOutputTokens: 1024,
          }
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Gemini error:', err);
      return NextResponse.json({ error: 'AI vision service error. Please try again.' }, { status: 500 });
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response
    const clean = rawText.replace(/```json|```/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);

    if (!match) {
      return NextResponse.json({
        error: 'Could not read the nameplate clearly. Try better lighting or move closer.'
      }, { status: 422 });
    }

    const parsed = JSON.parse(match[0]);
    return NextResponse.json({ ok: true, specs: parsed });

  } catch (err: any) {
    console.error('Nameplate API error:', err);
    return NextResponse.json({ error: err.message || 'Failed to analyse nameplate.' }, { status: 500 });
  }
}