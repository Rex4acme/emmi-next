// lib/ai.ts — AI helper functions (browser-side)
// Calls /api/ai which uses Pollinations AI (free, no key) with fallback chain

import type { Fault, AIFaultAnalysis, AIAssistantResult } from '@/types';

// ── Message type for conversation memory ─────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Call the AI proxy ─────────────────────────────────────────
async function callAI(
  prompt: string,
  systemPrompt: string,
  history: ChatMessage[] = []
): Promise<string> {
  // Build messages array including conversation history for memory
  const messages = [
    ...history,
    { role: 'user', content: prompt }
  ];

  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system:   systemPrompt,
      messages: messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `AI server error (${response.status})`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// ── System prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are EMMI AI — an expert electrical engineering assistant with 20+ years of experience in industrial power systems, maintenance, fault diagnosis, and SCADA/DCS systems. You help engineers troubleshoot faults, plan maintenance, and make safety-conscious decisions.

Always respond in valid JSON only. No markdown, no preamble, no explanation outside the JSON object.
Be technically precise. Use proper electrical engineering terminology.
Always include safety warnings for high-voltage or dangerous work.`;

// ── Fault Analysis ────────────────────────────────────────────
export async function analyzeFault(fault: Fault): Promise<AIFaultAnalysis> {
  const prompt = `Analyse this electrical fault and respond with a JSON object:

FAULT DETAILS:
- Title: ${fault.title}
- Equipment: ${fault.equipment?.name || 'Unknown'} (${fault.equipment?.tag_id || 'N/A'})
- Severity: ${fault.severity}
- Status: ${fault.status}
- Location: ${fault.fault_location || 'Not specified'}
- Description: ${fault.description || 'None provided'}
- Symptoms: ${fault.symptoms?.join(', ') || 'None listed'}
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
    const raw    = await callAI(prompt, SYSTEM_PROMPT);
    const json   = raw.replace(/```json|```/g, '').trim();
    // Find JSON object in response even if there's extra text
    const match  = json.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : json);
    return { ok: true, ...parsed };
  } catch (err: any) {
    return { ok: false, error: err.message || 'AI analysis failed' };
  }
}

// ── Q&A Assistant with conversation memory ────────────────────
export async function askQuestion(
  question: string,
  context?: string,
  history: ChatMessage[] = []
): Promise<AIAssistantResult> {
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
    const raw    = await callAI(prompt, SYSTEM_PROMPT, history);
    const json   = raw.replace(/```json|```/g, '').trim();
    const match  = json.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : json);
    return { ok: true, ...parsed };
  } catch (err: any) {
    return { ok: false, error: err.message || 'AI request failed' };
  }
}
