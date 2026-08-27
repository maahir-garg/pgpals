# PGPals 🐧

Event website for PGPals: The Emerald Challenge, PGPR's 2-week buddy challenge:
~200 teams of 2 complete
photo and video tasks, RAs review submissions and award PGP Coins, everyone watches the
leaderboard (until it goes dark before the closing ceremony).

**Stack:** Next.js 15 (App Router, TypeScript) · Supabase (Postgres, Auth,
Storage) · Tailwind + shadcn/ui · Vercel. Photo-only runs can fit free tiers;
video-heavy runs should use Supabase Pro.
Server functions are pinned to Vercel `sin1` so app clicks stay close to the
Singapore Supabase database.

---

## How it works (30 seconds)

- **Visitors** land on a public event page (what PGPals is, how it works,
  FAQ) with signup and login. Everything else needs an account.
- **Participants** (phones, but the layout scales up to laptops too): register
  for the event on NUSync first, then sign up with the exact email their RA
  entered on the team roster and get auto-linked to their pre-assigned team.
  The post-login **Guide** explains the challenge loop, media rules, multi-team
  tasks, reviews/resubmissions, common team/upload problems, and emergency
  contacts. Home also keeps the on-campus 24-hour CES number and off-campus
  emergency numbers one tap away. Signup prerequisites stay on the signup
  screen rather than being repeated after login.
  Participants complete tasks, submit 1-5 photo/video attachments plus a caption, earn PGP Coins (the
  event currency; the database still calls them points) on approval.
  Group tasks let 2-20 teams submit jointly.
- **Admins** (RAs, desktop): review queue (approve/reject with reason), task
  CRUD with scheduled release and bonus rules, CSV team import, member
  regrouping, manual bonus coins, announcements, event settings. The review queue shows 50 cards per
  page with Previous/Next pagination so media-heavy backlogs do not lock up
  the page.
- **Security is in the database, not the UI.** Row Level Security and SQL
  functions enforce: unreleased tasks invisible, submissions visible only to
  the owning team (plus accepted group members and admins), no submissions after the
  deadline, leaderboard returns *nothing* to participants after the hide
  date. `scripts/smoke-test.ts` proves all of this against a live database.
- All times display in **Asia/Singapore**; storage is UTC.

The repository now carries the final 2026 event seed: 100 published challenges,
the final RA allowlist, and one shared teamless admin account. It intentionally
contains no resident roster, teams, submissions, pairings, media, bonuses, or
announcements. Teams are imported only after the final roster is ready.

---

## Local development

Prereqs: Node 20+, Docker Desktop (running).

```bash
npm install
npx supabase start        # first run downloads images (~5 min)
npx supabase db reset     # applies supabase/migrations/*
npm run seed              # destructive final seed: tasks + RA access, no residents
npm run seed:review-test  # local-only 50-card media-heavy review fixture
npm run dev               # http://localhost:3000
```

`.env.local` already points at the local stack (the keys are the public local
development defaults).

Useful:

```bash
npx supabase status               # local URLs + keys
open http://127.0.0.1:54323      # Supabase Studio (local)
npm run build && npm run lint    # what Vercel will run
```

`npm run seed` is destructive and idempotent: it wipes all event data and Auth
users, then recreates the final tasks and admin access. It refuses non-local
URLs. The shared admin password is read from the gitignored
`.env.event.local` file through `PGPALS_SHARED_ADMIN_PASSWORD`; it is never
printed by the seed or committed.

For RA review and participant-flow testing, run `npm run seed:review-test`
after the normal seed. It refuses non-loopback Supabase URLs and replaces only
its own `[Review Test]` rows and `_review-load` private media. It creates 50
pending five-attachment submissions, five approved and five rejected examples,
and these local-only accounts:

| Role | Email | Password |
|---|---|---|
| RA | `review.ra@pgpals.local` | `LocalReviewRA2026!` |
| Top-20 participant | `review.participant@pgpals.local` | `LocalReviewPlayer2026!` |
| Outside-top-20 participant | `review.outside20@pgpals.local` | `LocalOutside20Player2026!` |

Remove only these fixtures with `npm run seed:review-test -- --clean`. The
production seed and production environment file are never used by this command.

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
   If direct port `5432` is blocked, load `.env.production.local` and push via
   the Supabase pooler on `6543`; do not print the URL because it contains the
   database password.
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

Then **sign up in the app** with that real email, and you'll be an admin. The
final seed installs the complete RA list before anyone signs up and creates the
shared checker account. Being on `admin_allowlist` is what makes an account an
admin (an email that already has an account is promoted on the spot). Use
**Demote & revoke** in *Admin → Settings* to remove a signed-up RA: it removes
the allowlist entry, changes the account to a participant, and revokes every
active Auth session in one transaction. The app refuses to remove the last
signed-up admin.

### 3. Vercel

1. Push this folder to a GitHub repo, import it in
   [vercel.com](https://vercel.com) (defaults are fine).
2. Add environment variables (Project → Settings → Environment Variables),
   values from *Supabase → Project Settings → API*:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key (`sb_publishable_...`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key (⚠️ secret: server-only, never expose) |

3. Deploy. Done. The URL is what you share with residents.

Every route is served with a Content Security Policy (`frame-ancestors 'none'`),
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a strict cross-origin
referrer policy, and a restrictive Permissions Policy. The CSP allows only the
app, Supabase API/signed-media hosts, the blob workers/previews used during
attachment compression, and Vercel Analytics. Keep those allowlists narrow when
adding an external service.

---

## Dry runs, backups, and D-day

Two env files decide which database local commands touch. **`.env.local`**
must always point at the local Docker stack; **`.env.production.local`**
holds the production values. Both are gitignored. `npm run seed` refuses to
run against anything that isn't the local stack.

### Final production seed

```bash
npm run seed:prod        # FINAL CUTOVER: destructive production seed, 5s abort window
```

This is the one-time final cutover. It deletes **everything** first, including
all Auth users and private submission media, then installs the 2026 event
window, 100 final published challenges, the ten named RA emails, and the shared
checker admin. It leaves teams, roster, submissions, pairings, upload batches,
bonuses, and announcements empty so the real roster can be imported cleanly.
The seed validates those counts before reporting success.

Before any production reseed, take `npm run backup:prod -- --photos` unless
you have explicitly decided to lose the current production media and rows.
The backup folder contains resident names, emails, photos, and videos; keep it out of
Git and move it only to an approved private location.

### Backups (do this daily during the event)

```bash
npm run backup:prod -- --photos    # full backup incl. all submission media (legacy flag name)
npm run backup:prod                # tables + auth users only (fast)
```

Writes `backups/<host>/<timestamp>/` containing `tables.json` (every table,
all rows), `auth-users.json`, and `photos/` (both photos and videos; legacy
folder name). A requested media backup exits with an error if even one object
cannot be downloaded. Passwords can't be exported, so
a worst-case restore means users reset passwords; scores, submissions, and
media files are all in the backup and final standings can be recomputed from
`tables.json` alone.

- During the event, run a media backup **once a day** (set a phone
  reminder) and before anything risky (schema change, bulk edit).
- Copy the latest backup folder somewhere off the laptop (Google Drive,
  etc.). The folder is gitignored; it contains resident names and emails,
  so treat it as personal data.

### D-day: clean build of production

Run this once, shortly before the event goes live (about 30 minutes end to end):

1. `npm run backup:prod -- --photos` — keep the final dry-run state.
2. `npx supabase db push` — apply any pending migrations.
3. Put the shared checker password in gitignored `.env.event.local` as
   `PGPALS_SHARED_ADMIN_PASSWORD=...`.
4. `npm run seed:prod` — performs the final destructive cutover and verifies
   the clean state.
5. Check *Admin → Settings* lists all ten named RAs plus the shared checker
   account.
6. Every individual RA signs up with their allowlisted email.
7. *Admin → Settings*: confirm event dates and the leaderboard hide date.
8. *Admin → Teams*: import the real roster CSV.
9. *Admin → Tasks*: spot-check release dates, deadlines, descriptions, group
   sizes, and the two judged-bonus instructions.
10. *Admin → Announcements*: post the welcome message.
11. Verify: log out and check the landing page shows the real dates; log
    back in and check the review queue is empty.
12. `npm run backup:prod` — a clean baseline backup after the roster import.
13. From this moment, **never run `npm run seed:prod` again**.

---

## CSV team import

*Admin → Teams → Import CSV.* One team per line, five columns
(header row optional). See [`sample-teams.csv`](./sample-teams.csv):

```csv
team_name,member1_name,member1_email,member2_name,member2_email
Prata Pioneers,Jamie Tan,jamie.tan@u.nus.edu,Yusuf Ahmad,yusuf.ahmad@u.nus.edu
```

- Emails are case-insensitive and must be the ones residents will sign up with.
- Duplicate team names and already-rostered emails are **skipped with a note**
  (shown after import). Fix the file and re-import, nothing breaks.
- After import, teams show ⏳ next to members until they sign up.
- Late changes: *Admin → Teams → (team)* lets you add, remove, or move
  members, rename, or delete. Removing a member also unlinks their account if
  they already signed up; moving a member relinks it to the new team.

---

## Configuring the event

*Admin → Settings*: event name, start/end, **leaderboard hide date**
(enforced in the database: participants get an empty response after this
moment, admins keep seeing it), and the **RA admin list** (emails there
become admins the moment they sign up).

Current 2026 defaults are 31 August to 13 September, with the leaderboard
going dark around 8 September. All times are SGT, and all three dates remain
editable in Settings.

Signup is roster-only: residents must use an email on a team roster, RAs an
email on the admin list. There is no other way in.

Email rules:
- Emails are lowercased and must match the roster/admin-list email exactly.
- Resident signup works only for emails in *Admin → Teams* roster.
- RA signup works only for emails in *Admin → Settings* admin list.
- There is no allowed-domain shortcut; `@u.nus.edu` is common, not magical.
- The normal signup and password-reset forms block reserved `.test` emails.

The **prize messaging is hardcoded** in `src/lib/prizes.ts` (S$5,000+ top 8
tech prize pool led by an iPad, confirmed monitors, Sony headphones, and
projectors teaser, AirPods lucky draw for all participants, finale reveal on
17 September, and participation goodie bags) and rendered on the landing page,
leaderboard, and dashboard. Changing it is a code edit plus deploy, which
keeps the advertising consistent everywhere.

*Admin → Tasks*: release/deadline datetimes (entered in SGT), standard or
pair/group type and team count, and publish toggle
(unpublished = invisible draft), and optional bonus:

| Bonus | Meaning |
|---|---|
| Early bird | first N approved submissions get +X |
| Before cutoff | submissions before a time get +X |
| Multiplier | submissions before a time get coins ×M |

Bonus coins are computed **at review time** by the database; the review
queue shows the auto amount and lets you override it.

---

## Day-of runbook for RAs 🧃

**Every morning (2 min)**
- Open *Admin → Overview*: pending count, submissions today, participation %.
- Check Supabase dashboard → *Storage* usage (see budget below).
- `npm run backup:prod -- --photos` and copy the folder to the shared drive.

**Through the day**
- Clear the review queue a few times a day, so rejected teams have time to
  resubmit before the deadline. Rejections **require a reason**; write it to
  the residents, they see it verbatim.
- The review queue shows 50 submissions per page. Use Next/Previous to move
  through a backlog; 50 is a rendering guardrail, not a task/submission cap.
- The admin-only **Approved** tab identifies the RA account that approved each
  submission by name and email.
- Approve = coins auto-computed (bonus included). Only override the number
  for special cases.
- Misclicked? *Review → Approved or Rejected tab → Undo review* puts it back
  to pending.
- New tasks going live? Post an announcement (pin the important ones).

**Common issues**
| Symptom | Fix |
|---|---|
| Generic "Could not create your account" at signup | To prevent roster/account enumeration the public form does not say whether an email exists. In *Admin → Teams*, find their team, check the roster email matches exactly, and fix/add it; otherwise ask them to try login or password reset. |
| "email rate limit exceeded" at signup | Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in the app environment; signup uses it to create confirmed rostered users without sending confirmation emails. For password reset emails, wait for the quota window or configure SMTP in Supabase Auth. |
| Resident on the wrong team, or two pals not getting along | *Admin → Teams → (team) → Move* next to the member: pick the destination team and they're regrouped (their account relinks automatically; coins already earned stay with the old team) |
| Team wants a name change | They can rename themselves on their dashboard (✏️ next to the name) |
| Submitted the wrong proof | Reject with a note; they can resubmit until the deadline |
| Pair invite stuck | Either team can cancel/decline on the task page; admins can delete pairings in Studio if truly wedged |
| Extra coins for event participation | *Admin → Teams → (team) → Grant bonus* (negative numbers work as penalties) |

**Storage budget (the one thing that can bite)**
Photos start at up to 15 MB and are compressed on-device to roughly 300 KB.
Each submission accepts five total attachments, including up to three videos;
each video is capped at 60 seconds and 50 MB, with a 100 MB combined video cap.
Participant copy recommends compressing each video below 5 MB for faster, more
reliable mobile uploads; this is guidance, not an additional rejection limit.
Before upload, the database reserves one fixed batch for the team and the app
server issues short-lived signed upload tokens for those exact paths. Direct
browser uploads outside a reservation are blocked. Final submission checks the
stored MIME types and byte sizes against the reservation; failed and expired
batches are removed by the server. Video duration is still verified by the RA
because Supabase Storage metadata does not provide a trustworthy duration.

For multi-team tasks, `pairings.team_ids` is also the authorization source of
truth: every invited team, including the third through twentieth members, can
read the group and respond. There are no separate first/second-team columns;
deleting a team with group history is blocked until those pairings are removed.

As of July 2026, Supabase Pro includes 100 GB file storage plus 250 GB each of
cached and uncached egress. Storage above the quota is $0.0213/GB/month;
uncached egress is $0.09/GB and cached egress is $0.03/GB. See the official
[storage pricing](https://supabase.com/docs/guides/storage/pricing),
[egress guide](https://supabase.com/docs/guides/platform/manage-your-usage/egress),
and [upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits).
A worst-case submission is about 100 MB, so 200 such submissions are about
20 GB before RA playback egress. Monitor Storage and Egress during video-heavy
task drops.

**Also good to know**
- Free Supabase projects pause after about a week with no traffic (outside
  the event). Dashboard → "Restore" wakes it up.
- The leaderboard hides itself automatically at the configured moment.
  Verify the date in Settings on day 1, then trust it.

---

## After the event

- Export final standings: log in as an RA, open the leaderboard, and select
  **Export CSV**. The page shows the top 20, but the RA-only download contains
  every team. The SQL fallback is `select * from get_leaderboard();` in Studio.
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
scripts/final-event-data.ts  final 100 challenges and RA allowlist
scripts/seed.ts        destructive final local/production cutover
scripts/seed-review-test.ts  local-only media-heavy RA review fixture
scripts/backup.ts      point-in-time backup (npm run backup:prod -- --photos)
scripts/smoke-test.ts  security checks against a live DB
scripts/render-test.ts page render checks against a running dev server
scripts/walkthrough.ts full-app screenshots for design review
src/lib/               supabase clients, types, SGT time helpers
src/app/page.tsx       public landing page
src/app/(auth)/        login/signup
src/app/(app)/         participant UI and event guide (mobile-first, desktop-aware)
src/app/admin/         admin UI (desktop-oriented)
```

Design notes worth knowing before editing:

- **Participants never write to `submissions`/`pairings` directly**; RLS
  blocks it. All writes go through SQL functions (`create_submission`,
  `create_pair_invite`, `respond_pair_invite`, `review_submission`, ...) that
  re-check every rule. The scalability migration adds transaction-scoped
  advisory locks around submission/review/pairing scopes, so simultaneous
  clicks cannot over-submit, over-approve, or double-pair. If you add a rule,
  add it there, not in the UI.
- **Scores are computed, never stored**: `team_score()` still gives one-team
  totals, while `get_leaderboard()` uses a set-based aggregate over approved
  submissions and bonus awards so the leaderboard does not call `team_score()`
  once per team. Before the hide date, participant calls return the top 20 plus
  their own team when it falls below the cutoff; admin calls retain the complete
  standings. The RPC also enforces the hide date.
- **Performance-sensitive reads stay narrow**: app pages load profile via
  `get_my_profile()`, admin count cards use aggregate RPCs, and review/task
  attachment URLs are signed in batches. Do not reintroduce broad `select("*")`
  calls on hot routes unless the UI truly needs every column.
- **Times**: stored UTC, displayed via `formatSGT()`; admin datetime inputs
  are interpreted as SGT (+08:00 fixed; Singapore has no DST).
- Photos and videos live in the private `submissions` bucket at
  `<team_id>/<uuid>/<attachment>`. Upload paths are generated by
  `reserve_submission_uploads()` and are writable only through signed upload
  tokens issued by the app server. The submission trigger verifies the real
  object metadata and consumes that exact batch; the server cleans failed or
  expired batches. Reads use 1-hour signed URLs after an RLS-checked submission
  query.
- The landing page reads event dates with the service-role client (anon has
  no table access); it shows nothing sensitive.
- **Design tokens live in `src/app/globals.css`** ("Playful Geometric"):
  cream paper background, slate ink, violet primary, with pink/amber/mint
  rotated for decoration. Hard offset shadows (`shadow-pop`,
  `shadow-sticker`), chunky 2px ink borders, pill buttons, and dashed
  dividers are the signature moves; semantic `success`/`warning` tints mark
  submission states. Headings are Outfit, body is Plus Jakarta Sans (see
  AGENTS.md for the full conventions).
