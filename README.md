# PGPals 🐧

Event website for PGPR's 2-week buddy challenge: ~200 teams of 2 complete
photo tasks, RAs review submissions and award points, everyone watches the
leaderboard (until it goes dark before the closing ceremony).

**Stack:** Next.js 15 (App Router, TypeScript) · Supabase (Postgres, Auth,
Storage) · Tailwind + shadcn/ui · Vercel. Fits free tiers for ~400 users.

---

## How it works (30 seconds)

- **Visitors** land on a public event page (what PGPals is, how it works,
  FAQ) with signup and login. Everything else needs an account.
- **Participants** (phones, but the layout scales up to laptops too): sign up
  with their rostered email, get auto-linked to their pre-assigned team,
  complete tasks, submit 1-5 photos plus a caption, earn points on approval.
  Pair tasks let two teams submit jointly.
- **Admins** (RAs, desktop): review queue (approve/reject with reason), task
  CRUD with scheduled release and bonus rules, CSV team import, manual bonus
  points, announcements, event settings.
- **Security is in the database, not the UI.** Row Level Security and SQL
  functions enforce: unreleased tasks invisible, submissions visible only to
  the owning team (plus pair partner and admins), no submissions after the
  deadline, leaderboard returns *nothing* to participants after the hide
  date. `scripts/smoke-test.ts` proves all of this against a live database.
- All times display in **Asia/Singapore**; storage is UTC.

Demo data is seeded so you can click through everything immediately (see
[Local development](#local-development)).

| Demo login | Email | Password |
|---|---|---|
| Admin (RA) | `ra@pgpals.test` | `pgpals123` |
| Participant | `chloe.lim@u.nus.edu` | `pgpals123` |
| Participant with a rejected, then resubmitted task | `shreya.iyer@u.nus.edu` | `pgpals123` |
| Rostered but never signed up (try the signup flow!) | `hafiz.bin.salleh@u.nus.edu` | n/a |

---

## Local development

Prereqs: Node 20+, Docker Desktop (running).

```bash
npm install
npx supabase start        # first run downloads images (~5 min)
npx supabase db reset     # applies supabase/migrations/*
npm run seed              # demo teams/tasks/submissions/photos
npm run dev               # http://localhost:3000
```

`.env.local` already points at the local stack (the keys are the public local
development defaults).

Useful:

```bash
npx supabase status               # local URLs + keys
open http://127.0.0.1:54323      # Supabase Studio (local)
npx tsx scripts/smoke-test.ts    # 34 security/rules checks (after seed)
npx tsx scripts/render-test.ts   # page render checks (needs npm run dev running)
npx tsx scripts/walkthrough.ts   # screenshots of every page, phone + desktop
npm run build && npm run lint    # what Vercel will run
```

`npm run seed` is destructive and idempotent: it wipes all data and recreates
the demo state. Never point it at production unless you mean it.

---

## Production setup (once, ~30 minutes)

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier,
   **Singapore region**).
2. Link and push the schema from your machine:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   (`<your-project-ref>` is in the dashboard URL. This runs the migration in
   `supabase/migrations/`: tables, security policies, storage bucket, all of it.)
3. **Disable email confirmation** (required, not optional):
   *Dashboard → Authentication → Sign In / Providers → Email → turn OFF
   "Confirm email".*
   Why: Supabase's built-in mailer sends only a couple of emails per hour;
   400 residents signing up would jam instantly. The roster allowlist is the
   real gate, so this is safe. (Optional: connect free SMTP like Resend under
   Auth → SMTP if you want password-reset emails to work.)

### 2. First admin account

In *Dashboard → SQL Editor*, run (with your email):

```sql
insert into admin_allowlist (email) values ('your.email@u.nus.edu');
```

Then **sign up in the app** with that email, and you'll be an admin. Promote
other RAs later in *Admin → Settings* (they must sign up first). To demote
someone: SQL Editor → `update profiles set role = 'participant' where email = '...';`

### 3. Vercel

1. Push this folder to a GitHub repo, import it in
   [vercel.com](https://vercel.com) (defaults are fine).
2. Add environment variables (Project → Settings → Environment Variables),
   values from *Supabase → Project Settings → API*:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon` `public` key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key (⚠️ secret: server-only, never expose) |

3. Deploy. Done. The URL is what you share with residents.

---

## CSV team import

*Admin → Teams → Import CSV.* One team per line, five columns
(header row optional). See [`sample-teams.csv`](./sample-teams.csv):

```csv
team_name,member1_name,member1_email,member2_name,member2_email
Waffle Warriors,Chloe Lim,chloe.lim@u.nus.edu,Wei Ling Tan,wei.ling.tan@u.nus.edu
```

- Emails are case-insensitive and must be the ones residents will sign up with.
- Duplicate team names and already-rostered emails are **skipped with a note**
  (shown after import). Fix the file and re-import, nothing breaks.
- After import, teams show ⏳ next to members until they sign up.
- Late changes: *Admin → Teams → (team)* lets you add/remove members, rename,
  or delete. Removing a member also unlinks their account if they already
  signed up.

---

## Configuring the event

*Admin → Settings*: event name, start/end, **leaderboard hide date**
(enforced in the database: participants get an empty response after this
moment, admins keep seeing it), and optional allowed email domains
(lets anyone on that domain sign up team-less; leave empty for roster-only).

*Admin → Tasks*: release/deadline datetimes (entered in SGT), standard or
pair type, max approvals (e.g. 3 for a daily task), publish toggle
(unpublished = invisible draft), and optional bonus:

| Bonus | Meaning |
|---|---|
| Early bird | first N approved submissions get +X |
| Before cutoff | submissions before a time get +X |
| Multiplier | submissions before a time get points ×M |

Bonus points are computed **at review time** by the database; the review
queue shows the auto amount and lets you override it.

---

## Day-of runbook for RAs 🧃

**Every morning (2 min)**
- Open *Admin → Overview*: pending count, submissions today, participation %.
- Check Supabase dashboard → *Storage* usage (see budget below).

**Through the day**
- Clear the review queue a few times a day, so rejected teams have time to
  resubmit before the deadline. Rejections **require a reason**; write it to
  the residents, they see it verbatim.
- Approve = points auto-computed (bonus included). Only override the number
  for special cases.
- Misclicked? *Review → filter Approved/Rejected → Undo review* puts it back
  to pending.
- New tasks going live? Post an announcement (pin the important ones).

**Common issues**
| Symptom | Fix |
|---|---|
| "My email isn't on the list" at signup | *Admin → Teams*: find their team, check the roster email matches exactly what they're typing; fix/add it, they retry |
| Resident on the wrong team | *Admin → Teams → (team)*: remove from wrong roster, add to right one; if already signed up, re-adding relinks them |
| Team wants a name change | They can rename themselves on their dashboard (✏️ next to the name) |
| Submitted the wrong photos | Reject with a note; they can resubmit until the deadline |
| Pair invite stuck | Either team can cancel/decline on the task page; admins can delete pairings in Studio if truly wedged |
| Extra points for event participation | *Admin → Teams → (team) → Grant bonus* (negative numbers work as penalties) |

**Storage budget (the one thing that can bite)**
Photos are compressed on-device to ~200 KB. Free tier = 1 GB storage,
5 GB/month egress, roughly 5,000 photos. With 20 tasks × 200 teams × 2-3
photos you may approach it. If the dashboard graph is trending past ~80% in
week 1: *Supabase → Billing → upgrade to Pro ($25/month, 100 GB)* for the
event month, downgrade after. No code changes needed.

**Also good to know**
- Free Supabase projects pause after about a week with no traffic (outside
  the event). Dashboard → "Restore" wakes it up.
- The leaderboard hides itself automatically at the configured moment.
  Verify the date in Settings on day 1, then trust it.

---

## After the event

- Export final standings: log in as admin, screenshot/copy the leaderboard
  (or Studio → SQL: `select * from get_leaderboard();`).
- Photos: keep them for the montage, or reclaim storage in *Studio → SQL*:
  ```sql
  -- ⚠️ permanently deletes every submission photo
  delete from storage.objects where bucket_id = 'submissions';
  ```
- Pause or delete the Supabase project; the Vercel site costs nothing idle.

---

## Project layout

```
supabase/migrations/   schema + RLS + RPCs (the security lives here)
scripts/seed.ts        demo data (npm run seed)
scripts/smoke-test.ts  security checks against a live DB
scripts/render-test.ts page render checks against a running dev server
scripts/walkthrough.ts full-app screenshots for design review
src/lib/               supabase clients, types, SGT time helpers
src/app/page.tsx       public landing page
src/app/(auth)/        login/signup
src/app/(app)/         participant UI (mobile-first, desktop-aware)
src/app/admin/         admin UI (desktop-oriented)
```

Design notes worth knowing before editing:

- **Participants never write to `submissions`/`pairings` directly**; RLS
  blocks it. All writes go through SQL functions (`create_submission`,
  `create_pair_invite`, `respond_pair_invite`, `review_submission`, ...) that
  re-check every rule. If you add a rule, add it there, not in the UI.
- **Scores are computed, never stored**: `team_score()` sums approved
  submissions (incl. joint pair credits) plus bonus awards, so totals can't
  drift. The leaderboard RPC wraps it with the hide-date check.
- **Times**: stored UTC, displayed via `formatSGT()`; admin datetime inputs
  are interpreted as SGT (+08:00 fixed; Singapore has no DST).
- Photos live in the private `submissions` bucket at `<team_id>/<uuid>/n.jpg`;
  the UI shows them via 1-hour signed URLs generated server-side after an
  RLS-checked read.
- The landing page reads event dates with the service-role client (anon has
  no table access); it shows nothing sensitive.
