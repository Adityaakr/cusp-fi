# CUSP Coming Soon Page

A React + Vite coming-soon + waitlist page for CUSP. Deploy this folder to Vercel to serve as the public face of the domain until private alpha is ready.

## Features

- Hero, value proposition, Phase 2/3 teasers
- **Join waitlist** — email registration via Supabase
- **Successfully registered** — confirmation after signup
- **Live count** — "{N} registered for CUSP Alpha" (updates every 30s)

## Supabase Setup

### 1. Run the schema

In [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor, run the contents of [`../docs/supabase-waitlist-schema.sql`](../docs/supabase-waitlist-schema.sql):

```sql
-- Creates: waitlist table (email, role), RLS policies, get_waitlist_count() RPC
```

If you already have the waitlist table, run [`../docs/supabase-waitlist-add-role.sql`](../docs/supabase-waitlist-add-role.sql) to add the `role` column.

### 2. Environment variables

Create `.env` in this folder (or set in Vercel):

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Get these from Supabase → Project Settings → API.

## Deploy to Vercel

### Option 1: Deploy from repo

1. Connect your repo to Vercel
2. In Project Settings → General → **Root Directory**, set to `coming-soon`
3. **Build & Development Settings:**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
5. Deploy

### Option 2: Deploy from CLI

```bash
cd coming-soon
npm install
cp .env.example .env   # Edit with your Supabase credentials
vercel
```

## Local development

```bash
cd coming-soon
npm install
cp .env.example .env   # Add your Supabase URL and anon key
npm run dev
```

## Design

Matches the main CUSP app:
- Dark theme (--bg-0, --bg-1)
- Teal accent (--cusp-teal)
- DM Sans + Geist Mono
- Minimal, professional, trustworthy tone
