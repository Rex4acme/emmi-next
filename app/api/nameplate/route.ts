// app/api/nameplate/route.ts
// Uses Google Cloud Vision API for OCR text extraction, then AI for structured JSON parsing.
// Free tier: 1,000 requests/month. Get API key from Google Cloud Console.
// Add as GOOGLE_VISION_API_KEY in Vercel → Settings → Environment Variables
// Also requires AI API for parsing (uses the /api/ai route)

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
    
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'GOOGLE_VISION_API_KEY not configured. Get your free key from Google Cloud Console (Vision API).',
        noKey: true,
      }, { status: 503 });
    }
    
    // Extract text using Google Cloud Vision API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: 'TEXT_DETECTION' }]
          }]
        }),
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!visionRes.ok) {
      const err = await visionRes.json().catch(() => ({}));
      console.error('Vision API error:', err);
      return NextResponse.json({
        error: 'Failed to extract text from image. Check API key and image quality.',
      }, { status: visionRes.status });
    }
    
    const visionData = await visionRes.json();
    const text = visionData.responses?.[0]?.textAnnotations?.[0]?.description || '';
    
    if (!text.trim()) {
      return NextResponse.json({
        error: 'No text detected in the image. Ensure the nameplate is clear and well-lit.',
      }, { status: 422 });
    }
    
    // Now, use AI to parse the extracted text into structured JSON
    const aiRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `Extract information from this nameplate text and return ONLY valid JSON:\n\n${text}` }],
        system: PROMPT
      })
    });
    
    if (!aiRes.ok) {
      console.error('AI API error:', await aiRes.text());
      // Fallback to key-value parsing
      const parsed = keyValueTextToJson(text);
      if (parsed && isValidNameplateData(parsed)) {
        return NextResponse.json({ ok: true, specs: parsed, method: 'fallback' });
      }
      return NextResponse.json({
        error: 'Failed to parse nameplate data. Try again or check the image.',
      }, { status: 422 });
    }
    
    const aiData = await aiRes.json();
    const rawText = aiData.result || '';
    const parsed = extractJsonFromText(rawText);
    
    if (!parsed || !isValidNameplateData(parsed)) {
      // Fallback
      const fallbackParsed = keyValueTextToJson(text);
      if (fallbackParsed && isValidNameplateData(fallbackParsed)) {
        return NextResponse.json({ ok: true, specs: fallbackParsed, method: 'fallback' });
      }
      return NextResponse.json({
        error: 'Could not extract valid data. Ensure the nameplate is readable.',
      }, { status: 422 });
    }
    
    return NextResponse.json({ ok: true, specs: parsed, method: 'ai' });
    
    // If AI fails, fallback parsing is handled above
    return NextResponse.json({
      error: 'Could not read the nameplate. Try: better lighting, move closer, avoid reflections, and make sure the nameplate fills the frame.',
    }, { status: 422 });
    
  } catch (err: any) {
    console.error(`[${requestId}] Nameplate route error:`, err);
    return NextResponse.json({ error: err.message || 'Server error.' }, { status: 500 });
  }
}