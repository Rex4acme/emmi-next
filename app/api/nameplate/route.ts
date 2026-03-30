// app/api/nameplate/route.ts
// Uses Google Gemini Flash vision to read equipment nameplates.
// Tries gemini-2.0-flash-exp first, falls back to gemini-1.5-flash.
// Free key: aistudio.google.com → Get API Key
// Add as GEMINI_API_KEY in Vercel → Settings → Environment Variables

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { NameplateData } from '@/types/types_index';

const PROMPT = `You are an expert electrical engineer with 20+ years experience reading industrial equipment nameplates.
Look very carefully at every character on this nameplate. Read each number and letter precisely.
Do NOT guess or approximate — if you see "3A" write "3A", not "7A". If unsure about a character, note it.

Extract ALL visible information and return ONLY valid JSON (no markdown, no explanation):
{
  "equipment_name": "exact equipment type e.g. Three Phase Induction Motor, Distribution Transformer, VFD, MCB",
  "manufacturer": "exact brand/manufacturer name as written",
  "model": "exact model or type designation",
  "serial_number": "exact serial number",
  "voltage_rating": "exact voltage e.g. 415V, 415/240V, 11kV/433V",
  "current_rating": "exact current with units e.g. 3A, 15.2A, 3/1.73A",
  "power_rating": "exact power with units e.g. 1.5kW, 75kW, 100kVA, 5HP",
  "frequency": "e.g. 50Hz",
  "speed_rpm": "e.g. 1450 rpm (motors only)",
  "power_factor": "e.g. 0.85",
  "efficiency": "e.g. 87.6%",
  "ip_rating": "e.g. IP55",
  "insulation_class": "e.g. Class F, Class B",
  "duty_cycle": "e.g. S1, Continuous",
  "connection": "e.g. Star/Delta, D/Y",
  "poles": "number of poles e.g. 4 poles",
  "standards": "e.g. IEC 60034, BS 5000, SON",
  "weight_kg": "weight if visible",
  "country_of_origin": "Made in...",
  "year_of_manufacture": "4-digit year if visible",
  "additional_specs": ["any other specs, ratings, or codes visible on the nameplate"],
  "confidence": "high if nameplate is clear, medium if partially worn, low if very worn/reflective",
  "notes": "note any difficulty reading, damaged areas, or unclear characters"
}`;

const MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
];

const MAX_IMAGE_SIZE_MB = 5;
const MAX_BASE64_LENGTH = MAX_IMAGE_SIZE_MB * 1024 * 1024 * 1.37; // base64 overhead ~37%

function extractJsonFromText(rawText: string): NameplateData | null {
  // Try direct parse first
  try {
    return JSON.parse(rawText);
  } catch {
    // Remove markdown code blocks
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Fallback to more aggressive cleaning
        const repaired = match[0]
          .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // ensure keys are quoted
          .replace(/,\s*}/g, '}') // remove trailing commas
          .replace(/,\s*]/g, ']');
        try {
          return JSON.parse(repaired);
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}

function isValidNameplateData(data: NameplateData | null): boolean {
  if (!data || typeof data !== 'object') return false;
  // Require at least one meaningful field
  const essentialFields: Array<keyof NameplateData> = ['equipment_name', 'manufacturer', 'model', 'serial_number'];
  return essentialFields.some(field => {
    const value = data[field];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function keyValueTextToJson(rawText: string): NameplateData | null {
  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const obj: Record<string, any> = {};
  for (const line of lines) {
    const split = line.split(/[:=]/);
    if (split.length < 2) continue;

    const key = split[0].trim().toLowerCase().replace(/\s+/g, '_');
    const value = split.slice(1).join(':').trim();
    if (!key || !value) continue;

    if (key === 'additional_specs') {
      obj[key] = value.split(/[,;]+/).map(v => v.trim()).filter(Boolean);
    } else {
      obj[key] = value;
    }
  }

  return Object.keys(obj).length ? obj : null;
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID().slice(0, 8);
  const startTime = Date.now();
  
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await request.json();
    
    if (!imageBase64) {
      return NextResponse.json({ error: 'No image received.' }, { status: 400 });
    }
    
    // Validate image size
    if (imageBase64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json({
        error: `Image too large. Maximum ${MAX_IMAGE_SIZE_MB}MB.`,
      }, { status: 413 });
    }
    
    // Validate mime type
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedMimes.includes(mimeType)) {
      return NextResponse.json({
        error: `Unsupported image format. Use JPEG, PNG, WEBP, or HEIC.`,
      }, { status: 415 });
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'GEMINI_API_KEY not configured. Add your free key from aistudio.google.com',
        noKey: true,
      }, { status: 503 });
    }
    
    // Try each model in order
    for (const model of MODELS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: PROMPT },
                  { inline_data: { mime_type: mimeType, data: imageBase64 } },
                ],
              }],
              generationConfig: { temperature: 0.05, maxOutputTokens: 1024 },
            }),
            signal: controller.signal,
          }
        );
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          // Model not found -> try next
          if (res.status === 404) continue;
          // Auth or quota errors -> stop immediately
          if (res.status === 401 || res.status === 403 || res.status === 429) {
            console.error(`Gemini auth/quota error (${model}):`, err);
            return NextResponse.json({
              error: res.status === 429 ? 'Gemini API quota exceeded. Try again later.' : 'Gemini API key invalid or expired.',
            }, { status: res.status });
          }
          console.error(`Gemini ${model} error (${res.status}):`, err);
          continue;
        }
        
        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = extractJsonFromText(rawText);
        
        if (!parsed || !isValidNameplateData(parsed)) {
          console.warn(`Model ${model} returned invalid data:`, parsed);
          continue;
        }
        
        // Add metadata
        parsed._model = model;
        parsed._latency_ms = Date.now() - startTime;
        
        return NextResponse.json({ ok: true, specs: parsed, model });
        
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.error(`Model ${model} timeout after 30s`);
        } else {
          console.error(`Model ${model} failed:`, err);
        }
        continue;
      }
    }
    
    // Fallback OCR path (PaddleOCR) — not available in production; use Gemini instead
    return NextResponse.json({
      error: 'Could not read the nameplate. Try: better lighting, move closer, avoid reflections, and make sure the nameplate fills the frame.',
    }, { status: 422 });
    
  } catch (err: any) {
    console.error(`[${requestId}] Nameplate route error:`, err);
    return NextResponse.json({ error: err.message || 'Server error.' }, { status: 500 });
  }
}