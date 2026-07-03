# PGPals Agent Guide

This file is for coding agents working in this repository. It explains what the
app is, how the pieces fit together, and the project-specific rules that matter
when making changes.

## Product Goal

PGPals is a web app for a two-week PGPR buddy challenge. Residents sign up with
their registered email, get linked to a team of two, complete photo tasks, and
earn points after RA review. Admins manage teams, tasks, announcements, reviews,
event settings, bonus points, and the leaderboard.

The app is meant to support roughly 400 residents on free-tier-friendly
infrastructure:

- Next.js App Router for the UI and server actions.
- Supabase for Postgres, Auth, Row Level Security, RPCs, and private Storage.
- Vercel for hosting, Web Analytics, and production deployments.

The important architectural principle is that the database is the security
boundary. The UI should be ergonomic, but it is not trusted.

## Current Production Shape

- Live Vercel URL: `https://pgpals-seven.vercel.app`
- Supabase project ref: `iobfzragbzqxmqnofvdj`
- Vercel project: `maahir-gargs-projects/pgpals`
- Vercel Web Analytics is enabled and `<Analytics />` is mounted in
  `src/app/layout.tsx`.
- Production env vars on Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

Vercel has been deployed with `vercel deploy --prod` from the local working
tree. That means production can include uncommitted local changes. Before doing
GitHub-driven deployments, commit and push the current source state so GitHub,
local, and Vercel agree.

## Repo Map

- `src/app/page.tsx`
  Public landing page. It reads public event dates with the service-role client
  because anon users do not have table access.

- `src/app/(auth)/`
  Login, signup, forgot-password, and reset-password screens. Auth server
  actions live in `src/app/(auth)/actions.ts`.

- `src/app/auth/callback/route.ts`
  Supabase Auth callback used for password recovery links. It exchanges the code
  and redirects to `/reset-password`.

- `src/app/(app)/`
  Participant app routes: dashboard, tasks, task detail, leaderboard, and
  participant server actions.

- `src/app/admin/`
  RA/admin routes and admin server actions: overview, teams, review queue,
  tasks, announcements, and settings.

- `src/components/pgpals/`
  Product-specific reusable UI pieces.

- `src/components/ui/`
  shadcn/radix-style primitives. Only the primitives actually in use are kept;
  add new ones with the shadcn CLI when a screen needs them, and remove them
  again if they stop being used.

- `src/lib/supabase/`
  Supabase clients:
  - `client.ts`: browser client.
  - `server.ts`: request-scoped server client using cookies.
  - `admin.ts`: service-role client, server-only.
  - `env.ts`: canonical public Supabase env values.

- `src/lib/types.ts`
  Hand-written database row types. Keep these in sync with migrations.

- `src/lib/data.ts`, `photos.ts`, `bonus.ts`, `datetime.ts`, `status.ts`
  Shared data loading, signed-photo URL helpers, bonus display helpers, SGT time
  formatting, and status utilities.

- `supabase/migrations/20260702000000_init.sql`
  The database schema, RLS policies, triggers, RPCs, storage bucket, and grants.
  Security-sensitive changes almost always belong here first.

- `scripts/seed.ts`
  Destructive local demo seed. Never run against production unless explicitly
  intended.

- `scripts/smoke-test.ts`
  Security and rules checks against a seeded database.

- `scripts/render-test.ts`, `scripts/walkthrough.ts`, `scripts/e2e-browser.ts`
  Browser/page verification scripts for local runs.

- `sample-teams.csv`
  Example CSV format for importing teams.

## Auth And Accounts

Hosted Supabase Auth rejects reserved `.test` emails. The demo account
`ra@pgpals.test` is local-only and should not be inserted into production.

Signup flow:

1. `signup_precheck(email)` runs before Auth signup for a friendly error.
2. Supabase Auth creates the user.
3. The `on_auth_user_created` trigger calls `handle_new_user()`.
4. `handle_new_user()` creates the profile only if the email is in:
   - `admin_allowlist`, or
   - `roster`, or
   - `event_settings.allowed_email_domains`.

First production admin:

```sql
insert into admin_allowlist (email) values ('real.email@u.nus.edu');
```

Then sign up with that real email. Do not use `ra@pgpals.test` in production.

Password reset:

- `/forgot-password` calls `resetPasswordForEmail`.
- Supabase sends a recovery link to `/auth/callback?next=/reset-password`.
- `/auth/callback` exchanges the code into a session.
- `/reset-password` updates the password and redirects to `/dashboard`.

If reset emails do not arrive, configure SMTP in Supabase Auth. The default
Supabase email sender is rate-limited and not ideal for an event.

## Database And Security Model

Treat Postgres as the source of truth and security layer.

- RLS is enabled on app tables and storage objects.
- Participants do not write `submissions` or `pairings` directly. They use RPCs
  such as `create_submission`, `create_pair_invite`, and
  `respond_pair_invite`.
- Admin review uses `review_submission`; bonus points are computed in the
  database at review time.
- Scores are computed, not stored. `team_score()` and `get_leaderboard()` derive
  standings from approved submissions and manual bonuses.
- The leaderboard hide date is enforced by `get_leaderboard()`, not just the UI.
- Private submission photos live in the `submissions` storage bucket. UI access
  goes through server-generated signed URLs after an RLS-checked read.

When changing rules, update the migration/RPCs first, then update UI affordances.

## Environment Variables

Canonical public client key:

```text
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Do not reintroduce `NEXT_PUBLIC_SUPABASE_ANON_KEY` unless there is a concrete
local-compatibility reason. Production and current docs should use the
publishable-key name.

Server-only secret:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Use the service-role key only in server-only code. Keep `src/lib/supabase/admin.ts`
importing `server-only`; do not import it into client components.

Database password:

```text
SUPABASE_DB_PASSWORD
```

This is for CLI database maintenance only. Do not add it to Vercel runtime env.

`.env.local` is ignored and can contain real secrets. Never print secret values
in chat or logs.

## Deployment Notes

Local verification:

```bash
npm run typecheck
npm run lint
npm run build
```

Vercel production deploy from local source:

```bash
npx vercel deploy --prod --yes
```

This uploads the local working tree and does not require pushing to GitHub.
However, GitHub-triggered deployments will only use committed/pushed code. Keep
GitHub in sync before relying on automatic deployments.

Supabase migration push:

```bash
npx supabase db push
```

If port `5432` is blocked from the current network, use the pooler on `6543`
with a `--db-url` built from `SUPABASE_DB_PASSWORD`. Do not print that URL,
because it contains the database password.

## Local Development

Normal local flow:

```bash
npm install
npx supabase start
npx supabase db reset
npm run seed
npm run dev
```

`npm run seed` is destructive and idempotent. It is for local/demo data.

Local demo accounts are documented in `README.md`. They use `.test` emails and
are not valid hosted Supabase Auth accounts.

## UI And Design Conventions

Design system: "Playful Geometric" (all tokens in `src/app/globals.css`).
Stable grid, wild decoration: content sits in clean readable blocks; energy
comes from shapes, chunky borders, and hard shadows around them.

- Palette: warm cream background (#FFFDF5), slate ink (#1E293B), vivid violet
  primary (#8B5CF6). Hot pink (`secondary`), amber (`accent`), and mint
  (`mint`) rotate for decorative shapes and icon circles - confetti, not
  semantics. The viewport `themeColor` in `src/app/layout.tsx` stays in sync
  with `--primary`.
- Semantic state colors: `success` (approved), `warning` (pending/bonus),
  `destructive` (rejected) are darker, text-safe shades. Badges use tints,
  e.g. `bg-success/15 text-success`. Do not reintroduce ad-hoc colors.
- Signature effects (defined as utilities/tokens in globals.css):
  `shadow-pop`/`-sm`/`-lg` (hard ink shadows for buttons and hero elements),
  `shadow-sticker` (soft hard shadow for cards), `shadow-focus-pop` (input
  focus), `bg-dots` (dot-grid texture), `transition-bouncy` (overshoot
  easing), `animate-wiggle`. Borders on interactive/sticker elements are
  `border-2 border-foreground`; section dividers are dashed
  (`border-dashed border-foreground/25`).
- Buttons are pills ("candy buttons"): dark 2px border + hard shadow that
  lifts on hover and presses on click. Cards are "stickers": 2px ink border,
  rounded-xl, sticker shadow, and may wiggle slightly on hover. Icons sit in
  colored circles with `strokeWidth={2.5}`, never floating alone.
- Typography: Outfit for headings (`--font-heading`, applied to h1-h4 in the
  base layer), Plus Jakarta Sans for body (`--font-sans`), both via
  `next/font`. Hero text caps at `text-6xl` on the landing page and
  `text-2xl`/`text-3xl` in the app.
- Decorative floating shapes are `aria-hidden` and hidden on phones so they
  never crowd content. Motion effects use `motion-safe:` or the
  reduced-motion overrides in globals.css.
- There is no dark mode. Do not add `.dark` styles without wiring a real
  theme switcher.
- Prizes are a core incentive: landing, dashboard leaderboard card, and the
  leaderboard page all remind residents that top teams win prizes at the
  closing ceremony. Keep that messaging when editing those surfaces.

Workflow conventions:

- Participants are mobile-first, but layouts should scale to desktop.
- The resident dashboard is a to-do list: rejected tasks first, then all open
  tasks ordered by deadline, then submissions in review, then announcements.
  Do not gate the to-do list on recency.
- The tasks page groups Closing soon / Open / Done / Closed. "Done" means all
  allowed approvals are used (`max_submissions`), so repeatable tasks stay
  open.
- Admin views are desktop-oriented and should be dense, scannable, and
  practical. The review queue is the primary surface: status tabs with counts,
  task/team filters preserved across tabs.
- Keep using the existing shadcn/radix primitives in `src/components/ui`.
- Keep domain components under `src/components/pgpals`.
- Use server components for read-heavy pages when possible; use client
  components for forms, uploads, and interactive controls.
- Use `formatSGT()` / `formatSGTDate()` for display times. Admin datetime inputs
  are interpreted as Singapore time.
- Do not add marketing-style screens when the route is an app surface. The app
  should get users to the workflow quickly.

## Common Maintenance Tasks

Delete a test user from production:

1. Find the user with `supabase.auth.admin.listUsers`.
2. Delete with `supabase.auth.admin.deleteUser(id)`.
3. Verify no matching rows remain in `profiles`, `roster`, or
   `admin_allowlist`.

Add an admin:

```sql
insert into admin_allowlist (email) values ('real.email@u.nus.edu');
```

Then have that person sign up.

Clean account leftovers:

- Auth users cascade to `profiles`.
- `created_by`, `reviewer_id`, and `awarded_by` references are `on delete set
  null`, so deleting an admin user should not delete event content.

## Things To Avoid

- Do not run `npm run seed` against production.
- Do not expose or commit `.env.local`.
- Do not import the service-role admin client into client components.
- Do not rely on UI checks for security. Put access rules in RLS/RPCs.
- Do not delete user data casually. Verify target rows first, then delete.
- Do not assume a Vercel deploy means GitHub is current.
- Do not re-add unused Next starter assets unless a route actually uses them.

## Validation Checklist

For most code changes:

```bash
npm run typecheck
npm run lint
npm run build
```

For database or RLS changes:

```bash
npx supabase db reset
npm run seed
npx tsx scripts/smoke-test.ts
```

For route/render changes:

```bash
npm run dev
npx tsx scripts/render-test.ts
```

For broad UI changes:

```bash
npx tsx scripts/walkthrough.ts
```

Document any check that could not be run.

