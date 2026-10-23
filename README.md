# Planora AI — Intelligent Event Planning Assistant

<p align="center">
  <strong>Plan meaningful moments. Leave the chaos to us.</strong><br/>
  An AI-powered workspace for planning weddings, birthdays, and community events.
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
  <img alt="Google Gemini" src="https://img.shields.io/badge/AI-Google%20Gemini-8E75B2?logo=googlegemini&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Backend-Supabase-3FCF8E?logo=supabase&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Styling-Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white" />
</p>

---

## Overview

**Planora AI** is a full-stack event-planning assistant that turns an event idea into an actionable planning workspace. Users can create celebrations, organize budgets and preparation tasks, generate tailored plans with Google Gemini, and keep their workspace available through Supabase-backed persistence.

Planora supports three event categories:

- **Weddings** — coordinate venues, ceremonies, catering, guests, and preparation timelines.
- **Birthdays** — plan themes, food, entertainment, decorations, and activities.
- **Community events** — organize programs, volunteers, venues, logistics, and shared responsibilities.

> **Project status:** Functional development project. Add a public demo URL and screenshots after deployment.

## Features

- **Personalized AI plans** — generate event concepts, budget breakdowns, timelines, vendor checklists, and ideas using event details and user preferences.
- **Event workspace** — manage event dates, locations, guest counts, budgets, and checklists.
- **Budget guidance** — view planned spending totals and suggested category allocations.
- **Task tracking** — mark preparation tasks complete and persist their status.
- **Saved and linked plans** — reopen generated plans and associate them with dashboard events.
- **Authentication** — sign up and sign in with Supabase Auth, manage a display name, and sign out.
- **Cloud persistence** — store events, tasks, and generated plans in Supabase Postgres.
- **Local cache and migration** — import eligible browser records into the signed-in user's cloud workspace and cache data locally.
- **Light/dark theme** — switch themes with a browser-persisted preference.
- **PDF export** — save an AI plan through the browser's print dialog.

AI-generated budgets and recommendations are estimates, not verified vendor quotes. Validate prices, availability, contracts, permits, and safety requirements independently.

## Product workflow

1. Register or sign in.
2. Create a wedding, birthday, or community event.
3. Enter the date, location, guest count, budget, and preferences.
4. Track preparation tasks and planned spending from the dashboard.
5. Generate a personalized AI plan with Gemini.
6. Save and reopen plans, link plans to events, and export a plan to PDF.
7. Return to the workspace after signing in to retrieve cloud-stored records.

## Technology stack

| Area | Technology |
|---|---|
| Framework | Next.js App Router |
| Language | TypeScript |
| UI | React |
| Styling | Tailwind CSS and application CSS |
| Icons | Lucide React |
| Generative AI | Google Gemini through `@google/genai` |
| Authentication | Supabase Auth |
| Database | Supabase / PostgreSQL |
| Session integration | Supabase JavaScript client and SSR integration |
| Plan rendering | `react-markdown`, `remark-gfm` |
| Validation | TypeScript compiler and Next.js build |

Use the installed versions in `package.json` and `package-lock.json` as the definitive dependency versions for this checkout.

## Architecture

```text
Browser
└── Next.js App Router
    ├── Dashboard
    │   ├── Events and budgets
    │   ├── Task checklist
    │   └── Account controls
    ├── AI Planner
    │   ├── Event details and preferences
    │   ├── Rendered Gemini plan
    │   ├── Saved plan history
    │   └── Print / Save as PDF
    ├── API route: /api/plan
    │   └── Google Gemini API (server-side)
    ├── Authentication callback and session handling
    └── Supabase clients
        ├── Supabase Auth
        └── PostgreSQL + Row Level Security
            ├── events
            ├── event_tasks
            └── ai_plans
```

The Gemini API key must remain server-side. Never expose a Gemini key or Supabase service-role key in client code or a `NEXT_PUBLIC_` variable.

### Data model

The application cloud helper expects three main tables:

- **`events`** — owner ID, local migration ID, event name/type/date/location, guest count, budget, and timestamps.
- **`event_tasks`** — parent event ID, local task ID, title, completion status, and ordering.
- **`ai_plans`** — owner ID, local migration ID, optional linked event, event details, preferences, and generated plan content.

Local IDs and unique constraints support repeatable imports. The live database schema and migrations should remain the source of truth; verify that the schema in Supabase matches the columns used in the code.

## Getting started

### Prerequisites

- Node.js compatible with the Next.js version in the lockfile
- npm
- A Supabase project
- A Google Gemini API key
- Git

### 1. Clone the repository

```bash
git clone https://github.com/soumojit-dev/Planora-AI.git
cd Planora-AI
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env.local` file in the repository root. Use the exact variable names expected by the source code. The Supabase browser client commonly requires:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Configure the Gemini key using the exact server-side variable referenced by `src/app/api/plan/route.ts`. Do **not** prefix the Gemini key with `NEXT_PUBLIC_`.

Never commit `.env.local`, API keys, access tokens, passwords, Supabase secret keys, or production data.

### 4. Configure Supabase

1. Create a Supabase project.
2. Create the tables, indexes, and constraints required by the cloud helper.
3. Enable Row Level Security (RLS) on each user-data table.
4. Add policies that restrict operations to the authenticated owner and validate ownership through parent events for tasks and linked plans.
5. Configure Supabase Auth site URLs and redirect URLs, including the local callback used by this application (for example, `http://localhost:3000/auth/callback` when applicable).
6. Test access with at least two separate test accounts.

Enabling RLS does not automatically create the required policies. Review and test policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Validate before deployment

```bash
npx tsc --noEmit
npm run build
```

Resolve errors before deploying, and test authentication and RLS behavior against your development Supabase project.

## Source layout

```text
src/
├── app/
│   ├── api/plan/route.ts       # Server-side Gemini plan generation
│   ├── auth/callback/route.ts  # Authentication callback
│   ├── ai-planner/page.tsx     # AI planning UI and saved plans
│   ├── login/page.tsx          # Sign-in and account creation
│   ├── globals.css             # Global, theme, and print styles
│   ├── layout.tsx              # Root layout and global controls
│   └── page.tsx                # Event dashboard
├── components/
│   └── planora-controls.tsx    # Theme toggle and PDF export
├── lib/
│   ├── planora-cloud.ts        # Cloud sync and data import helpers
│   └── supabase/
│       ├── client.ts           # Browser Supabase client
│       ├── server.ts           # Server Supabase client
│       └── proxy.ts            # Session helper
└── proxy.ts                    # Next.js request/session proxy
```

This is a guide to the key files; verify paths against the checked-out source as the project evolves.

## Security and data handling

- Keep Gemini credentials on the server only.
- Keep local environment files out of version control.
- Use RLS as the database authorization boundary; UI visibility and redirects are not authorization.
- Validate event ownership when writing tasks and linked AI plans.
- Do not trust user-supplied IDs as proof of ownership.
- Treat local storage as a cache, not as the authoritative cloud database.
- Treat cloud-sync warnings as failed writes until the corresponding record has been verified.
- Test first-time imports, repeat imports, account switching, and network failures with disposable test records before relying on migration for important data.
- Avoid logging sensitive user content or credentials.

## Manual test plan

- [ ] Create an account and complete email confirmation if enabled.
- [ ] Sign in, refresh, sign out, and sign in again.
- [ ] Create an event and verify its row in `events`.
- [ ] Toggle a task and verify `event_tasks.completed`.
- [ ] Generate an AI plan and verify its row in `ai_plans`.
- [ ] Open a saved plan and verify its event association.
- [ ] Switch themes and verify preference persistence after refresh.
- [ ] Export an AI plan to PDF and inspect the saved document.
- [ ] Test a second account and ensure the first account's data is inaccessible.
- [ ] Test cloud failures and check that save failures are surfaced in the UI.
- [ ] Run `npx tsc --noEmit` and `npm run build`.

## Deployment checklist

- [ ] Push reviewed application source and this README to GitHub.
- [ ] Configure required environment variables in the hosting provider.
- [ ] Update Supabase Auth site URL and production redirect allow-list.
- [ ] Verify RLS policies and parent-record ownership checks.
- [ ] Confirm secrets are absent from Git history and client bundles.
- [ ] Run a production build and test the deployed authentication callback.
- [ ] Test event, task, and plan access using a non-owner account.
- [ ] Test theme persistence and PDF export in the production browser.

## Roadmap

- [ ] Public demo and product screenshots
- [ ] Automated tests and continuous integration
- [ ] Versioned database migrations
- [ ] Retry queues and conflict handling for failed/offline writes
- [ ] Vendor directory, quote comparison, and deadline reminders
- [ ] Account data export and deletion workflow
- [ ] Expanded accessibility and mobile usability testing

## Contributing

Issues and pull requests are welcome. For larger changes, open an issue first to discuss scope. Do not include secrets, real user data, or production database exports in issues or pull requests.

## License

No license has been specified. Until a license file is added, permission to reuse, distribute, or modify the project is not automatically granted.

## Author

**Soumojit Maitra** · [GitHub profile](https://github.com/soumojit-dev)

---

<p align="center"><sub>Built to make event planning more organized, personal, and less stressful.</sub></p>
