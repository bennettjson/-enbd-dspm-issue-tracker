# ENBD DSPM Issue Tracker

Forcepoint & Emirates NBD shared portal for tracking DSPM support cases.

## Stack

- **Source**: `enbd-issue-tracker_1.tsx` — single React component, all logic inline
- **Build**: Vite + React 18 + TypeScript (Node 20)
- **Hosting**: GitHub Pages (static, permanent URL)
- **Shared state**: Supabase `kv_store` table (REST API, no SDK)
- **State fallback chain**: `window.storage` (Claude artifact) → Supabase → `localStorage`
- **Live data**: Anthropic API → CData MCP → Salesforce comments + Jira GS tickets (FP only)

## Commands

```bash
npm install          # install dependencies
npm run dev          # local dev → http://localhost:5173
npm run build        # production build → dist/
npm run preview      # preview dist/ locally
```

## First-time Setup

### 1. Supabase (shared state)

1. Create a free project at https://supabase.com
2. Go to SQL Editor and run `supabase-setup.sql`
3. Go to Settings → API and copy **Project URL** and **anon public** key
4. Copy `.env.local.example` → `.env.local` and fill in both values
5. Add the same values as GitHub repo secrets:
   - `SUPABASE_URL` → your Project URL
   - `SUPABASE_ANON_KEY` → your anon public key

### 2. GitHub Pages

1. Push this repo to GitHub
2. Go to repo Settings → Pages → Source: **GitHub Actions**
3. Push to `main` — the workflow builds and deploys automatically
4. Live URL: `https://<username>.github.io/<repo-name>/`

## Project Structure

```
enbd-issue-tracker_1.tsx   ← THE source — all edits go here
src/
  main.tsx                 ← React entry (imports from _1.tsx)
  window.d.ts              ← window.storage type declaration
  vite-env.d.ts            ← Vite env types
.github/workflows/
  deploy.yml               ← auto-deploy on push to main (injects Supabase secrets)
supabase-setup.sql         ← run once in Supabase SQL Editor
.env.local.example         ← copy to .env.local for local dev
index.html
package.json
vite.config.ts
tsconfig.json
CLAUDE.md                  ← this file (Nimbalyst reads this)
```

## Key Storage Keys (never rename)

| Key | Shared | Purpose |
|-----|--------|---------|
| `enbd-v4-overrides` | yes | FP status/notes overrides per case |
| `enbd-v4-comments` | yes | All user comments |
| `enbd-v4-changelog` | yes | Full audit log |
| `enbd-v4-added` | yes | Cases added via UI (+ Add Case) |
| `enbd-v4-apikey` | yes | Anthropic API key (FP staff set once) |
| `enbd-v4-user` | no | User identity (per session, localStorage only) |
| `enbd-v4-lastvisit` | no | Timestamp for new-since-visit dots (localStorage only) |

Shared keys go to Supabase (or `window.storage` in Claude artifact).
Non-shared keys (`shared=false`) stay in `localStorage` only.

## Roles

- **Forcepoint** (`fp`): full edit — status, owner, res notes, roadmap, eng flag, add cases, live SF/Jira data
- **ENBD** (`enbd`): view + comments + confirm resolved (on unconfirmed cases)

## Storage Indicator

The footer shows which backend is active:
- `☁ Supabase · shared across all users` — all team edits/comments sync in real time
- `⚠ localStorage · changes not shared` — Supabase not configured, local only

## Salesforce

Base URL: `https://forcepoint2.lightning.force.com/lightning/r/Case`
Account: Emirates NBD · `0015f00000R7aqFAAR`

## Open Tasks

- [ ] Realtime Supabase subscription (auto-refresh when another user makes a change)
- [ ] Search result text highlighting
- [ ] Stat card counts respect owner filter
- [ ] Mobile layout improvements

## Notes for Nimbalyst

Use `/nimbalyst-planning:implement` to pick up tasks from the Open Tasks list above.
The canonical source file is `enbd-issue-tracker_1.tsx` — all code changes go there.
Run `npm run dev` with a valid `.env.local` to test Supabase integration locally.
