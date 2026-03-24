# ⚡ EMMI — Electrical Maintenance Intelligence

> **Professional electrical maintenance logbook and plant management platform for industrial engineers.**

EMMI is built for electrical engineers working in industrial plants — refineries, cement factories, power stations, manufacturing facilities. It replaces paper logbooks, WhatsApp groups, and scattered Excel sheets with a single intelligent platform that the entire plant engineering team shares in real time.

---

## What EMMI Does

### 🔌 Equipment Registry
Every piece of electrical equipment at your plant lives in EMMI. Motors, transformers, switchgear, VFDs, panels, instrumentation — each with a tag ID, voltage rating, power rating, manufacturer details, installation date, photos, and live status. No more searching through binders for a nameplate.

### ⚡ Fault Tracking
When a fault occurs, log it in under 60 seconds from your phone. Capture severity (Low / Medium / High / Critical), symptoms, measurements, affected circuit, downtime in minutes, and photos straight from your camera. Every fault gets a unique fault code automatically.

### 🤖 AI Fault Analysis
Every logged fault can be analysed by EMMI's AI engine (powered by Groq / Llama 3.3 70B). It returns:
- Probable root causes ranked by likelihood
- Step-by-step corrective actions with tools required
- Safety warnings for high-voltage or live-line work
- Spare parts likely needed
- Prevention tips to avoid recurrence

The AI chat assistant on the dashboard answers any electrical engineering question and remembers the full conversation.

### 🔧 Activity Logging
Document all maintenance work — Preventive Maintenance, Corrective Maintenance, Inspection, Testing, Calibration, Overhaul, Installation. Log work order references, permit numbers, colleagues present, tools used, parts replaced, findings, actions taken, and engineer signature.

### 📡 Plant Feed
A live activity feed showing every engineer's faults, activities, and shift logs the moment they are posted. Like a professional WhatsApp group for engineering events — but structured, searchable, and stored permanently. Engineers can post quick updates, flag incorrect entries, and delete their own posts.

### 🟢 Real-Time Online Presence
See which engineers at your plant are currently active in the app. When a colleague logs a fault or activity, a toast notification slides in on your screen and a phone banner notification fires even when the app is in the background.

### 📋 Shift Handover Logs
At the end of every shift, engineers log their full handover: events with timestamps and equipment tags, unresolved issues, and a direct message to the next shift team. The incoming shift reads it the moment they open the app.

### ✅ Maintenance Tasks
Senior engineers and admins assign maintenance tasks to colleagues with priority level, due date, and equipment linked. Everyone sees all plant tasks. Status updates in real time.

### 🏥 Equipment Health Scores
Every equipment gets a live 0–100 health score computed from faults and downtime in the last 30 days. Green = healthy. Amber = warning. Red = critical. The worst equipment floats to the top automatically, so engineers know exactly where to focus.

### 📦 Spare Parts & Inventory
Track all spare parts and consumables in one place. Log part numbers, categories, equipment compatibility, store location, supplier, and unit cost. One-tap quantity adjustments when parts are used. Low-stock alerts when stock falls below your set minimum. The whole plant team shares the same inventory.

### 📊 KPI Dashboard
Annual performance report generated automatically: total faults resolved, critical faults handled, downtime hours saved, activities completed, resolution rate percentage. Engineers use this for appraisals, audits, and plant management reports.

### 🔑 Plant ID Collaboration
Engineers join the same plant by typing one shared Plant ID in their profile. No admin setup required. Send colleagues a direct email invite with one tap — the invite link pre-fills their Plant ID automatically when they sign up.

### 🔐 Authentication
Google Sign-In and email/password via Supabase Auth. Forgot password flow with email reset link. Invite colleagues via email with a one-click join link.

### 📱 PWA — Native App Experience
EMMI installs on any Android or iOS device directly from the browser — no app store, no approval process. Works offline: engineers can read their faults and activities even when internet drops. Data syncs automatically when connection returns. Long-press the home screen icon to jump directly to "Log Fault" or "Plant Feed".

---

## Who It's For

- **Electrical Engineers** in industrial plants who need a professional logbook
- **Senior Engineers & HODs** who need visibility across their team's work
- **Maintenance Managers** who need KPI data for reporting and audits
- **Plant Managers** who want a real-time view of plant electrical health

---

## AI Engine

EMMI's AI runs on **Groq** (Llama 3.3 70B Versatile) — one of the fastest AI inference engines available. Responses are near-instant. Groq is used as the primary provider with automatic fallback to Llama 3.1 8B Instant and Pollinations AI, so the AI is always available even during high-demand periods.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS + custom design system |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Realtime | Supabase Realtime (presence + postgres changes) |
| Storage | Supabase Storage (photos, avatars) |
| Auth | Supabase Auth (Google OAuth + email) |
| AI | Groq API — Llama 3.3 70B Versatile |
| Deployment | Vercel |
| PWA | Service Worker + Web App Manifest |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Engineer profiles, Plant ID, role |
| `equipment` | Equipment registry |
| `faults` | Fault logs |
| `resolutions` | Fault resolutions |
| `activities` | Maintenance activity logs |
| `categories` | Equipment categories |
| `activity_types` | Activity type definitions |
| `fault_categories` | Fault classification categories |
| `shift_logs` | Shift handover logs + plant feed posts |
| `tasks` | Maintenance task assignments |
| `equipment_health` | Computed health scores |
| `spare_parts` | Inventory and spare parts tracking |

---

## Security

All data is protected by Supabase Row Level Security (RLS). Engineers only see:
- Their own equipment, faults, activities (write access)
- Their plant colleagues' data (read access, same Plant ID)

Admins and Senior Engineers have additional delete permissions on the plant feed.

---

## App Version

**EMMI v2.0** — Multi-user plant edition  
Built for industrial electrical engineering teams in Nigeria and West Africa.

---

*Every fault logged. Every shift handed over. Every engineer connected.*