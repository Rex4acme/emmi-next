# ⚡ EMMI — Electrical Maintenance Intelligence

Personal electrical equipment management, fault tracking, and AI-powered troubleshooting logbook. Built with **Next.js 14**, **Supabase**, **Anthropic Claude AI**, and deployed on **Vercel**.

---

## Features

- 🔌 **Equipment Registry** — Track all electrical equipment with tag IDs, specs, photos
- ⚡ **Fault Logging** — Log faults with severity, symptoms, measurements, photos
- 🤖 **AI Fault Analysis** — Claude Sonnet AI analyses faults and recommends actions
- 🔧 **Activity Logging** — Record maintenance activities with work order refs, PTW
- 🔔 **7am Reminders** — Browser notification for unresolved overnight faults
- 📷 **Photo Attachment** — Take photos with camera OR pick from local device/gallery
- 🔐 **Secure Auth** — Google Sign-In and email/password via Supabase
- 📱 **PWA** — Installable on Android/iOS as a home screen app

---

## Setup Guide

### 1. Supabase Setup (free)

1. Go to [supabase.com](https://supabase.com) → Create a new project
2. Go to **SQL Editor** → paste the entire contents of `supabase/schema.sql` → **Run**
3. Go to **Authentication** → **Providers** → Enable **Google** (add your Google OAuth credentials)
4. Go to **Storage** → Create a bucket named `photos` → set to **Public**
5. Go to **Project Settings** → **API** → copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon/public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys
2. Create a new key → copy it → this is your `ANTHROPIC_API_KEY`

### 3. Google OAuth (for Google Sign-In)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → Create project
2. APIs & Services → OAuth 2.0 → Create credentials
3. Authorised redirect URIs: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
4. Add Client ID and Secret to Supabase → Authentication → Google provider

### 4. Deploy to Vercel

```bash
# 1. Push this folder to a GitHub repo
# 2. Go to vercel.com → Import your GitHub repo
# 3. Framework: Next.js (auto-detected)
# 4. Add Environment Variables:
```

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (sk-ant-...) |

```bash
# 5. Deploy → done!
```

---

## Local Development

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.local.example .env.local
# Edit .env.local with your keys

# Run dev server
npm run dev
# Open http://localhost:3000
```

---

## File Structure

```
emmi-next/
├── app/
│   ├── api/ai/route.ts          # Anthropic AI proxy (server-side)
│   ├── auth/page.tsx            # Login/signup page
│   ├── auth/callback/route.ts   # OAuth callback
│   ├── dashboard/page.tsx       # Main dashboard
│   ├── equipment/               # Equipment pages
│   ├── faults/                  # Fault pages + AI analysis
│   ├── activities/              # Activity pages
│   ├── profile/page.tsx         # Profile setup
│   ├── globals.css              # EMMI design system
│   └── layout.tsx               # Root layout
├── components/
│   ├── layout/AppShell.tsx      # Sidebar + mobile nav
│   └── ui/PhotoPicker.tsx       # Camera + file picker
├── hooks/
│   └── useFaultReminder.ts      # 7am reminder hook
├── lib/
│   ├── supabase.ts              # Supabase client factory
│   ├── db.ts                    # All database queries
│   ├── ai.ts                    # AI helper functions
│   └── utils.ts                 # Formatters + helpers
├── types/index.ts               # TypeScript types
├── supabase/schema.sql          # Database schema (run in Supabase)
└── .env.local.example           # Environment variables template
```

---

## 7am Fault Reminder

When you open the app between 7am–9am, it automatically:
1. Checks for faults logged before midnight that are still unresolved
2. Shows an in-app banner listing the faults
3. Fires a browser push notification (requires permission)
4. Marks them as reminded so they don't repeat

---

## AI Analysis

Every fault page has an **Analyse** button powered by Claude Sonnet:
- Probable root causes with likelihood ratings
- Step-by-step recommended actions with tools needed
- Safety warnings for high-voltage work
- Parts likely needed
- Prevention tips

The AI assistant on the dashboard answers free-form electrical engineering questions.
