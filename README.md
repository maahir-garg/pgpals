# PGPals

PGPals was the event website for The Emerald Challenge, a two-week buddy challenge run in September 2026 for my residence, PGPR at the National University of Singapore. I built it and ran it on my own. Teams of two completed photo and video tasks, Residential Assistants (RAs) reviewed the submissions and awarded PGP Coins, and a leaderboard tracked the standings.

## Status

The event is over and the deployed site is offline. The repository is kept as a record of the project and is not maintained. The seed data in the repository ships with placeholder RA accounts (`ra01@example.com` and similar) and a placeholder shared admin account; it contains no resident data.

## What it does

- A public landing page with the event description, how it works and FAQ, plus signup and login.
- Roster-only signup. RAs import teams from a CSV; a resident can only sign up with an email that appears on a team roster, and is linked to that team automatically. RAs sign up with an email on the admin allowlist.
- Participants browse released tasks, submit one to five photo or video attachments with a caption, and earn PGP Coins when an RA approves. The database calls the coins "points".
- Group tasks that let between two and twenty teams submit together, with invites between teams.
- Client-side photo compression and reserved, signed upload paths for attachments.
- A leaderboard that shows the top 20 plus the participant's own team, and returns nothing to participants after a configurable hide date. RAs can export the full standings as CSV.
- An admin area: review queue (approve or reject with a reason, undo), task management with scheduled release and bonus rules, CSV team import, member moves, manual bonus coins, announcements and event settings.
- A post-login guide with the media rules and emergency contacts.
- Times are shown in Asia/Singapore and stored in UTC.

## Tech stack

- Next.js 15 (App Router) with React 19 and TypeScript
- Supabase: Postgres with Row Level Security and SQL functions, Auth, and private Storage
- Tailwind CSS 4, shadcn/ui and Radix UI, lucide-react, sonner
- browser-image-compression, papaparse, react-markdown
- Vercel hosting and Vercel Analytics (server functions were pinned to `sin1`, close to the Singapore database)
- tsx for the scripts, Playwright for the browser scripts

## Running it locally

You need Node 20 or later and Docker, since the database runs in the Supabase local stack.

```bash
npm install
npx supabase start
npx supabase db reset      # applies supabase/migrations
npm run seed               # destructive; local only; tasks and RA allowlist, no residents
npm run dev                # http://localhost:3000
```

Copy `.env.example` to `.env.local` and fill in the values printed by `npx supabase status`. Put `PGPALS_SHARED_ADMIN_PASSWORD` in a gitignored `.env.event.local`; the seed reads both files.

Environment variables (names only):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `PGPALS_SHARED_ADMIN_PASSWORD` (seed only)

`npm run seed` wipes all event data and Auth users, then recreates the final 100 challenges and the admin access. It refuses to run against a non-local Supabase URL. `npm run seed:review-test` adds a local-only fixture of 50 pending media-heavy submissions and a few test accounts for trying the review queue; `npm run seed:review-test -- --clean` removes it.

Other scripts in `package.json`: `build`, `start`, `lint`, `typecheck`, `backup` and `backup:prod`. `seed:prod` was the one-time production cutover and is destructive. The backup script writes tables, Auth users and submission media to a gitignored `backups/` folder, which would contain personal data if run against a real event.

## Project layout

```
supabase/migrations/   schema, Row Level Security policies, SQL functions, storage bucket
scripts/               seed, backup and test scripts; final-event-data.ts holds the 100 challenges
src/app/page.tsx       public landing page
src/app/(auth)/        login, signup and password reset
src/app/(app)/         participant pages: dashboard, tasks, leaderboard, guide
src/app/admin/         admin pages
src/components/        app components and shadcn/ui primitives
src/lib/               Supabase clients, types, Singapore time helpers, bonus and prize logic
```

## Design notes

- The database is the security boundary. Participants never write to `submissions` or `pairings` directly; writes go through SQL functions (`create_submission`, `create_pair_invite`, `respond_pair_invite`, `review_submission` and others) that re-check every rule. Advisory locks stop simultaneous clicks from over-submitting, over-approving or double-pairing.
- Row Level Security keeps unreleased tasks hidden, shows submissions only to the owning team, accepted group members and admins, and blocks submissions after the deadline.
- Scores are computed, not stored. `get_leaderboard()` aggregates approved submissions and bonus awards in one query and enforces the hide date.
- Attachments live in the private `submissions` bucket. The database reserves a batch of upload paths per team, the server issues short-lived signed upload tokens for exactly those paths, and a trigger checks the stored MIME types and sizes when the submission is made.
- Every route is served with a Content Security Policy, `X-Frame-Options: DENY`, `nosniff`, a referrer policy and a permissions policy, configured in `next.config.ts`.
- `AGENTS.md` has longer notes on conventions, and `Design.md` describes the visual design.

## Tests and checks

- `npm run lint` and `npm run typecheck`.
- `scripts/smoke-test.ts` checks the database rules as anonymous, participant and admin clients, and `scripts/render-test.ts` checks page rendering against a running dev server. Both were written against an earlier demo seed with sample teams and tasks, which `npm run seed` no longer creates, so they will not pass against the current seed without those fixtures.
- `scripts/e2e-browser.ts` and `scripts/walkthrough.ts` use Playwright to drive the app and take screenshots.

## Credits

Built and run by Maahir Garg.
