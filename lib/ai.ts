// lib/ai.ts — AI helper functions (browser-side)
// These functions call /api/ai (our Next.js API route) which
// then calls Anthropic Claude securely server-side.
// The Anthropic API key is NEVER exposed to the browser.

import type { Fault, AIFaultAnalysis, AIAssistantResult } from '@/types';

// ── Call the AI proxy ─────────────────────────────────────────
// All AI requests go through /api/ai which adds the API key server-side.
// model: claude-sonnet-4-5 — best balance of speed, quality, and cost
async function callAI(prompt: string, systemPrompt: string): Promise<string> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',    // Anthropic Claude Sonnet — fast and capable
      max_tokens: 1500,               // Max response length
      system: systemPrompt,           // Sets AI persona and context
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `AI server error (${response.status})`);
  }

  const data = await response.json();
  // Extract text from Anthropic's response structure
  return data.content?.[0]?.text || '';
}

// ── System prompt — sets AI persona ──────────────────────────
// This tells Claude to act as an electrical engineering expert
const SYSTEM_PROMPT = `You are EMMI AI — an expert electrical engineering assistant with 20+ years of experience in industrial power systems, maintenance, fault diagnosis, and SCADA/DCS systems. You help engineers troubleshoot faults, plan maintenance, and make safety-conscious decisions.

Always respond in valid JSON only. No markdown, no preamble, no explanation outside the JSON object.
Be technically precise. Use proper electrical engineering terminology.
Always include safety warnings for high-voltage or dangerous work.`;

// ── Fault Analysis ────────────────────────────────────────────
// Given a fault record, return structured diagnostic analysis
export async function analyzeFault(fault: Fault): Promise<AIFaultAnalysis> {
  const prompt = `Analyse this electrical fault and respond with a JSON object:

FAULT DETAILS:
- Title: ${fault.title}
- Equipment: ${fault.equipment?.name || 'Unknown'} (${fault.equipment?.tag_id || 'N/A'})
- Category: ${fault.fault_category?.name || 'Unknown'}
- Severity: ${fault.severity}
- Status: ${fault.status}
- Detected: ${fault.detected_at}
- Detection Method: ${fault.detection_method || 'Not specified'}
- Location: ${fault.fault_location || 'Not specified'}
- Affected Circuit: ${fault.affected_circuit || 'Not specified'}
- Safety Impact: ${fault.safety_impact || 'Not assessed'}
- Downtime: ${fault.downtime_minutes ? fault.downtime_minutes + ' minutes' : 'Not recorded'}
- Description: ${fault.description || 'None provided'}
- Symptoms: ${fault.symptoms?.join(', ') || 'None listed'}
- Measurements: ${fault.measurements ? JSON.stringify(fault.measurements) : 'None recorded'}
- Is Recurring: ${fault.is_recurring ? 'Yes' : 'No'}

Respond ONLY with this JSON structure:
{
  "summary": "2-3 sentence expert overview of this fault",
  "confidence": "high|medium|low",
  "probable_causes": [
    { "cause": "cause name", "likelihood": "high|medium|low", "explanation": "why this is likely" }
  ],
  "recommended_actions": [
    { "step": 1, "action": "action name", "detail": "detailed instruction", "tools": "instruments needed" }
  ],
  "safety_warnings": ["warning 1", "warning 2"],
  "parts_needed": ["part 1", "part 2"],
  "prevention_tip": "How to prevent this fault recurring"
}`;

  try {
    const raw = await callAI(prompt, SYSTEM_PROMPT);
    const json = raw.replace(/```json|```/g, '').trim(); // strip any accidental markdown
    const parsed = JSON.parse(json);
    return { ok: true, ...parsed };
  } catch (err: any) {
    return { ok: false, error: err.message || 'AI analysis failed' };
  }
}

// ── Q&A Assistant ─────────────────────────────────────────────
// Answer a free-form engineering question from the dashboard
export async function askQuestion(question: string, context?: string): Promise<AIAssistantResult> {
  const prompt = `Answer this electrical engineering question:

QUESTION: ${question}
${context ? `CONTEXT: ${context}` : ''}

Respond ONLY with this JSON:
{
  "summary": "Direct answer in 2-3 sentences",
  "key_points": ["key point 1", "key point 2", "key point 3"],
  "safety_note": "Any safety consideration (or empty string if none)",
  "next_step": "The single most important action to take"
}`;

  try {
    const raw = await callAI(prompt, SYSTEM_PROMPT);
    const json = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(json);
    return { ok: true, ...parsed };
  } catch (err: any) {
    return { ok: false, error: err.message || 'AI request failed' };
  }
}
