# PGPals Agent Guide

This file is for coding agents working in this repository. It explains what the
app is, how the pieces fit together, and the project-specific rules that matter
when making changes.

## Product Goal

PGPals: The Emerald Challenge is a web app for a two-week PGPR buddy challenge.
Residents register for the event on NUSync first, then use the exact email an
RA entered on a team roster to create their account and get linked to a resident
team of two. They complete photo/video tasks and earn PGP Coins after RA review. Some group tasks
join 2, 3, or a custom 4–20 resident teams for one shared submission. Admins
manage teams, tasks, announcements, reviews, event settings, bonus coins, and
the leaderboard.

The app is meant to support roughly 400 residents on free-tier-friendly
infrastructure:

- Next.js App Router for the UI and server actions.
- Supabase for Postgres, Auth, Row Level Security, RPCs, and private Storage.
- Vercel for hosting, Web Analytics, and production deployments.

The important architectural principle is that the database is the security
boundary. The UI should be ergonomic, but it is not trusted.

## Current Production Shape

- Live Vercel URL: `https://pgpals.vercel.app`
- Supabase project ref: `iobfzragbzqxmqnofvdj`
- Vercel project: `maahir-gargs-projects/pgpals`
- Vercel Web Analytics is enabled and `<Analytics />` is mounted in
  `src/app/layout.tsx`.
- `next.config.ts` applies CSP/frame protections, `nosniff`, Referrer-Policy,
  and Permissions-Policy to every route. CSP derives the exact HTTP/WebSocket
  and signed-media origin from `NEXT_PUBLIC_SUPABASE_URL`, so both the local
  stack and hosted project work without a wildcard; it also allows blob
  attachment workers/previews and Vercel Analytics. Update the narrow
  allowlists when adding a new origin.
- Runtime route region is pinned with `preferredRegion = "sin1"` in
  `src/app/layout.tsx` so server-rendered app clicks stay close to the
  Singapore Supabase database.
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
  Participant app routes: dashboard, tasks, task detail, event guide,
  leaderboard, and participant server actions. `/guide` is the resident-facing
  source for challenge rules, media limits, multi-team behavior, reviews,
  resubmissions, common post-login troubleshooting, and emergency contacts.

- `src/app/admin/`
  RA/admin routes and admin server actions: overview, teams, review queue,
  tasks, announcements, and settings.

- `src/components/pgpals/`
  Product-specific reusable UI pieces.

- `src/components/ui/`
  shadcn/radix-style primitives. Only primitives and subcomponent exports that
  are actually in use are kept; add new ones with the shadcn CLI when a screen
  needs them, and remove them again if they stop being used. Internal helpers
  used to assemble a primitive do not need to be exported.

- `src/lib/supabase/`
  Supabase clients:
  - `client.ts`: browser client.
  - `server.ts`: request-scoped server client using cookies.
  - `admin.ts`: service-role client, server-only.
  - `env.ts`: canonical public Supabase env values.

- `src/lib/types.ts`
  Hand-written database row types. Keep these in sync with migrations.

- `src/lib/data.ts`, `attachments.ts`, `bonus.ts`, `datetime.ts`, `status.ts`
  Shared data loading, signed-media URL helpers, bonus display helpers, SGT time
  formatting, and status utilities.

- `supabase/migrations/20260702000000_init.sql`
  The database schema, RLS policies, triggers, RPCs, storage bucket, and grants.
  Security-sensitive changes almost always belong here first.

- `supabase/migrations/20260704000000_scalability_hardening.sql`
  Performance and concurrency hardening: hot-path indexes, advisory locks for
  submission/review/pairing scopes, live-pairing guard trigger, set-based
  leaderboard, `get_my_profile()`, and admin aggregate RPCs. Keep future
  performance-sensitive DB changes in migrations, not only in UI code.

- `supabase/migrations/20260705*.sql`
  The 2026 run's simplifications: drop the editable prize list (hardcoded in
  `src/lib/prizes.ts` instead), set the real event window defaults (31 Aug to
  13 Sep SGT, leaderboard dark around 8 Sep, still editable in Settings),
  roster-only signup (no allowed-email-domains), and the `move_roster_member`
  RPC for regrouping.

- `supabase/migrations/20260715*.sql`
  The Emerald Challenge rename, generalized 2–20-team group pairings, and the
  single-approval invariant. Group membership lives in `pairings.team_ids`,
  each invitee records acceptance in `accepted_team_ids`, and all invited teams
  must accept before the group can submit. The final cleanup migration removes
  the obsolete `pairings.team_a`/`team_b` and `tasks.max_submissions` columns;
  `team_ids` is the sole membership field and one approval is unconditional.
  The video attachment migration expands the private bucket to MP4/MOV/WebM,
  enforces 1–5 supported attachments with no more than 3 video paths, and sets
  a 50 MB per-object bucket cap. The upload-reservation migration then removes
  direct participant Storage inserts: `reserve_submission_uploads()` validates
  the task and media budget, server actions issue path-specific signed upload
  tokens, and the submission trigger verifies actual Storage metadata before
  atomically consuming the batch.

- `src/lib/prizes.ts`
  Hardcoded prize messaging and ceremony date, rendered by the landing page,
  leaderboard, and dashboard.

- `scripts/final-event-data.ts`, `scripts/seed.ts`
  Final 2026 event data and destructive cutover seed. `npm run seed` targets
  the local stack via `.env.local` and refuses non-local URLs;
  `npm run seed:prod` deliberately wipes production via
  `.env.production.local` after a 5-second abort window. Both commands create
  the same final state: real event settings, 100 published challenges, the ten
  named RA emails, and one shared teamless admin, with no resident roster,
  teams, submissions, pairings, upload batches, bonuses, announcements, or
  media. The shared admin password is loaded from the gitignored
  `.env.event.local` file and is never printed or committed.

- `scripts/seed-review-test.ts`
  Additive, idempotent, local-only review-load fixture run with
  `npm run seed:review-test` after the final seed. It refuses non-loopback
  Supabase URLs, replaces only `[Review Test]` rows and `_review-load` private
  media, and creates 50 pending five-attachment submissions plus approved and
  rejected examples. It also creates fixed local RA, top-20 participant, and
  outside-top-20 participant credentials documented in README, and verifies
  their leaderboard scopes. `--clean` removes only these fixtures; the command
  never reads `.env.production.local`.

- `scripts/backup.ts`
  Read-only point-in-time backup (`npm run backup` / `backup:prod`,
  `--photos` to include all storage media; the flag name is legacy) into the
  gitignored `backups/` directory. It includes upload-reservation rows and exits
  unsuccessfully if any requested media object cannot be downloaded.

- `scripts/smoke-test.ts`
  Security and rules checks against a seeded database.

- `scripts/render-test.ts`, `scripts/walkthrough.ts`, `scripts/e2e-browser.ts`
  Browser/page verification scripts for local runs.

- `sample-teams.csv`
  Example CSV format for importing teams.

## Auth And Accounts

Hosted Supabase Auth can reject reserved `.test` emails. Do not rely on
`.test` for production admins. The final seed contains no `.test` accounts.

Signup flow:

1. `signup_precheck(email)` runs as a neutral availability check. It always
   returns the same `{ "ok": true }` response and must never reveal whether an
   email is rostered, allowlisted, already registered, or linked to a name/team.
2. Supabase Auth creates the user.
3. The `on_auth_user_created` trigger calls `handle_new_user()`.
4. `handle_new_user()` creates the profile only if the email is in:
   - `admin_allowlist` (RAs; they get the admin role), or
   - `roster` (residents; they get linked to their pre-assigned team).

There is no other signup path. The old allowed-email-domains escape hatch
(team-less signups for whole domains) was removed to keep the gate simple:
residents are roster-only, RAs are allowlist-only.

Email criteria: emails are lowercased and must match roster/admin_allowlist
exactly. `@u.nus.edu` is conventional for residents, not a domain-wide bypass.
Public signup failures stay generic to avoid turning the server action into an
email-enumeration endpoint; admins diagnose roster mismatches in Admin -> Teams.
The public signup/reset forms block `.test`; seeded/admin-created `.test`
accounts can log in only if hosted Supabase accepts them.

First production admin:

```sql
insert into admin_allowlist (email) values ('real.email@u.nus.edu');
```

Then sign up with that real email. The final cutover seed normally bootstraps
the complete RA allowlist and shared checker account instead. Every later RA
is added in Admin -> Settings, which writes to
`admin_allowlist` and promotes an already-existing account immediately. The
same screen's **Demote & revoke** action calls `demote_admin(email)`, which
atomically removes the allowlist entry, changes an existing profile back to a
participant, and deletes all of that user's Auth sessions. An advisory lock and
a last-signed-up-admin check prevent concurrent demotions from locking everyone
out.

Password reset:

- `/forgot-password` calls `resetPasswordForEmail` with a dedicated implicit-
  flow client and redirects new recovery links to `/auth/recovery`. This avoids
  tying a link to the PKCE verifier in the browser that requested it, so email
  in-app browsers and other devices work without a custom hosted email template.
- `/auth/recovery` validates the recovery fragment and converts its access and
  refresh tokens into the cookie-backed session used by the SSR app, then opens
  `/reset-password`.
- `/auth/callback` still accepts legacy PKCE `code` links and server-verifiable
  recovery `token_hash` links, rejects protocol-relative `next` paths, and sends
  invalid or expired links back to the request form with an explicit retry
  message.
- `/reset-password` updates the password and redirects to `/dashboard`.

If reset emails do not arrive, configure SMTP in Supabase Auth. The default
Supabase email sender is rate-limited and not ideal for an event.

## Database And Security Model

Treat Postgres as the source of truth and security layer.

- RLS is enabled on app tables and storage objects.
- Participants do not write `submissions` or `pairings` directly. They use RPCs
  such as `create_submission`, `create_pair_invite`, and
  `respond_pair_invite`.
- Group tasks have an exact `pair_team_count` between 2 and 20. The creator
  selects every partner at once, every invited team must accept, and any member
  team may then create the group's one shared submission. Every team in
  `pairings.team_ids` receives the approved submission's coins. RLS also uses
  `team_ids` as the sole membership source so every invited team can load the
  group. Teams with group history cannot be deleted until those pairings are
  removed, preventing dangling array memberships.
- Admin review uses `review_submission`; bonus points are computed in the
  database at review time, and `admin_submission_award_previews()` supplies the
  same calculation to the review UI so there is no second TypeScript bonus
  implementation. Submission creation/review and pair invites use
  transaction-scoped advisory locks so concurrent clicks cannot over-submit,
  over-approve, or double-pair.
- Every standard task or accepted group can receive exactly one approved
  submission. One RA decision completes the review; there is no repeat-approval
  setting in the admin task form. Rejected submissions may still be fixed and
  resubmitted before the deadline.
- Scores are computed, not stored. `team_score()` derives one team's score;
  `get_leaderboard()` uses a set-based aggregate over approved submissions and
  manual bonuses so standings do not require one score query per team. Before
  the hide date, participants receive only the top 20 rows plus their own team
  if it is below the cutoff; admins retain the complete result for operations.
- Admins can remove an individual mistaken manual bonus from the team-detail
  page after a confirmation. The existing admin-only `bonus_awards` RLS policy
  protects deletion, and computed team/leaderboard totals update immediately;
  participants can still only read their own team's bonus history.
- The leaderboard hide date is enforced by `get_leaderboard()`, not just the UI.
- Private submission photos and videos live in the `submissions` storage bucket. UI access
  goes through server-generated signed URLs after an RLS-checked read.
- Participant uploads are reservation-only. The browser first calls
  `reserve_submission_uploads()` through a server action; the database permits
  one live batch per team, generates every object path, and enforces 1–5 files,
  at most 3 videos, 50 MB per video, 100 MB combined video bytes, and 2 MB per
  compressed photo. The server then issues short-lived signed upload tokens.
  Direct authenticated Storage inserts are denied. At submission time the
  trigger checks object existence, MIME/extension agreement, actual byte sizes,
  task/team/pairing ownership, and the exact unexpired batch before consuming it.
  Failed or expired batches are deleted with the server-only client; do not add
  a broad participant delete policy or return to client-generated paths.
- Hot server routes should keep payloads narrow. Use `get_my_profile()` for
  request profile loading, aggregate RPCs for admin counts, and batched signed
  URLs (`getSignedAttachmentUrlMap`) for media-heavy pages. Do not reintroduce broad
  `select("*")` calls on dashboard/tasks/review pages unless every column is
  needed.

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

Apply database migrations before deploying app code that depends on new RPCs.
For example, the performance changes require `get_my_profile()` and admin
aggregate RPCs to exist before the matching Next.js deployment serves traffic.

## Local Development

Normal local flow:

```bash
npm install
npx supabase start
npx supabase db reset
npm run seed
npm run seed:review-test
npm run dev
```

`npm run seed` is destructive and idempotent. It creates the final participant-
free event state locally. Use the shared teamless admin to inspect admin pages;
run `npm run seed:review-test` when testing the 50-card media-heavy review queue
or participant flows. The review fixture is local-only and must never be copied
to production.

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
  leaderboard page all advertise the prize pool. It is hardcoded in
  `src/lib/prizes.ts` (S$5,000+ top 8 tech prize pool led by an iPad,
  confirmed monitors, Sony headphones, and projectors teaser, AirPods lucky
  draw for all participants, finale reveal, participation goodie bags,
  ceremony on 17 September) so the pitch is identical everywhere; there is no
  admin setting for it. Change the module, not individual pages.
- The user-facing currency is **PGP Coins** ("coins" on second mention, the
  `Coins` lucide icon on chips/badges). Database columns, RPCs, and code
  identifiers still say `points` - rename copy, never schema.
- The dashboard is team-scoped: users without a team (including RAs who
  aren't playing) get a simplified view with announcements and, for admins,
  a pointer to the admin console. Don't add team-scoped widgets outside the
  team branch.

Workflow conventions:

- Participants are mobile-first, but layouts should scale to desktop.
- Keep the shared emergency contact card visible on participant Home and near
  the top of `/guide`. The numbers are tap-to-call links: NUS Campus Emergency
  & Security at `+65 6874 1616` (24 hours), and outside campus ambulance/fire
  at `995` and police at `999`.
- Keep `/guide` help copy aligned with the actual submission, pairing, scoring,
  and deadline rules whenever those workflows change. Do not repeat NUSync,
  rostering, or account-creation onboarding after login; those prerequisites
  belong on the signup screen.
- The resident dashboard is a to-do list: rejected tasks first, then all open
  tasks ordered by deadline, then submissions in review, then announcements.
  Do not gate the to-do list on recency. On stacked/mobile layouts, the Guide
  card sits directly below the team summary; on desktop it stays in the sidebar.
  "Up next" renders at most six open tasks and links to the rest.
- The tasks page groups Closing soon / Open / Done / Closed. "Done" means the
  team or accepted group has one approved submission for the task.
- The leaderboard displays only the top 20 teams. A participant whose team is
  outside that group still sees a separate row with their exact rank and coin
  total; no other teams below the cutoff are shown. RAs get an **Export CSV**
  action on the leaderboard whose admin-only route downloads the complete
  standings, including teams below the display cutoff.
- Admin views are desktop-oriented and should be dense, scannable, and
  practical. The review queue is the primary surface: status tabs with counts,
  task/team filters preserved across tabs, and 50 review cards per page with
  Previous/Next pagination. The 50-card limit is a render guardrail, not a
  cap on tasks or submissions. Only the first photo in each of the first two
  cards receives eager/high loading priority; later photos lazy-load and decode
  asynchronously, videos do not preload, and offscreen cards use
  `content-visibility` to avoid unnecessary rendering work. Approved-tab cards
  show the approving RA profile name and email; that attribution is admin-only
  and is not added to participant submission history.
- The admin team-detail name field is an immediately editable 2–40 character
  form. Its Rename action stays available for valid text, supports Enter,
  reports duplicate names clearly, and refreshes both admin and participant
  team-name displays after saving.
- Announcement action buttons use `Pin` for an unpinned announcement and
  `PinOff` for a pinned announcement so the next action is visually distinct;
  the small `Pin` beside a title remains the current-state indicator.
- Keep using the existing shadcn/radix primitives in `src/components/ui`.
- Keep domain components under `src/components/pgpals`.
- Use server components for read-heavy pages when possible; use client
  components for forms, uploads, and interactive controls.
- Submission proof supports 1–5 total attachments: photos up to 15 MB before
  browser compression, and up to 3 MP4/MOV/WebM videos. Each video is at most
  60 seconds / 50 MB and combined videos are at most 100 MB. Participant copy
  recommends videos under 5 MB for upload reliability; this is guidance, not
  an enforced limit. All media uses database-reserved paths and short-lived
  signed upload tokens. The database
  independently checks file count, MIME/extension agreement, 2 MB compressed
  photos, 50 MB videos, 100 MB combined video bytes, object existence, and exact
  batch ownership. Duration remains an RA review rule because Storage metadata
  does not expose a trustworthy media duration; reject longer clips.
- Before compression or upload, the participant form samples the original
  file's first/last metadata regions and filename for common AI-generator
  signatures. A match blocks that selection and a clean scan produces visible
  feedback. This client-side check is an advisory deterrent, can be bypassed or
  miss stripped metadata, and never replaces RA review; do not describe it as
  a reliable content classifier or a database security boundary.
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

Admin -> Settings -> "Add an RA email". That writes to `admin_allowlist`; the
person becomes an admin at signup (or immediately if they already have an
account). The SQL fallback, needed only to bootstrap the first admin:

```sql
insert into admin_allowlist (email) values ('real.email@u.nus.edu');
```

Remove an admin:

Admin -> Settings -> "Demote & revoke". Do not update `profiles.role` directly:
the RPC-backed workflow also removes the allowlist entry, revokes active Auth
sessions, and refuses to remove the last signed-up admin.

Clean account leftovers:

- Auth users cascade to `profiles`.
- `created_by`, `reviewer_id`, and `awarded_by` references are `on delete set
  null`, so deleting an admin user should not delete event content.

## Things To Avoid

- Do not point `.env.local` at production. It must always hold the local
  stack values; production credentials live in `.env.production.local` and
  are only used by the explicit `:prod` scripts. (This went wrong once:
  the seed wiped production because `.env.local` had been switched.)
- The final production cutover happens only via `npm run seed:prod`, and never
  again after the real roster is imported (README → "D-day: clean build of
  production").
- The production seed wipes Auth users, event rows, submissions, and storage
  media before installing the final task/admin state. Take
  `npm run backup:prod -- --photos` first unless the user explicitly accepts
  losing current production data; backups contain resident names, emails,
  photos, and videos, so treat them as private data.
- Do not expose or commit `.env.local` or `.env.production.local`.
- Do not import the service-role admin client into client components.
- Do not rely on UI checks for security. Put access rules in RLS/RPCs.
- Do not delete user data casually. Verify target rows first, then delete.
- Do not assume a Vercel deploy means GitHub is current.
- Do not re-add unused Next starter assets unless a route actually uses them.

## Commit Discipline

- Keep each requested fix in its own focused commit unless the user explicitly
  asks for a different grouping.
- Every implementation commit must include an `AGENTS.md` update documenting
  the behavior, schema, workflow, deployment, or maintenance change introduced
  by that commit. Review the whole guide for stale statements; do not only add
  a changelog entry.
- Never add agent attribution, co-author trailers, or self-credit to commits.

## Recent Changes

- 2026-08-28: added a lightweight pre-compression media metadata scan that
  blocks common AI-generator signatures, confirms clean checks to participants,
  and keeps RA review authoritative for generated or misleading proof.
- 2026-08-28: made announcement pinning actions visually unambiguous by using
  separate pin and unpin icons while retaining the pinned-state title marker.
- 2026-08-28: added confirmed removal of individual manual bonus awards on the
  admin team-detail page so accidental awards or penalties can be reversed and
  computed scores update immediately.
- 2026-08-28: repaired the admin team-name editor so its Rename action remains
  usable for valid names, validates the same 2–40 character range as the
  participant editor, handles duplicates clearly, and refreshes team displays.
- 2026-08-27: added approving-RA name and email attribution to the admin-only
  Approved review tab.
- 2026-08-27: added an RA-only full-leaderboard CSV export while keeping the
  on-page leaderboard limited to the top 20 teams.
- 2026-08-27: added an isolated local-only review-load seed with 50 pending
  five-attachment submissions, reviewed examples, representative private media,
  fixed RA/top-20/outside-top-20 test accounts, idempotent fixture cleanup, and
  a strict loopback URL guard; production seeding remains unchanged.
- 2026-08-27: made the RA review queue media-aware: only the first photo in each
  of the first two cards gets eager/high loading priority, later photos
  lazy-load and decode asynchronously, videos wait for playback before loading,
  and offscreen cards skip rendering work.
- 2026-08-19: made password recovery reliable across browsers and email apps
  without requiring custom SMTP: reset requests now use an implicit-flow client,
  `/auth/recovery` turns the returned fragment into an SSR cookie session, and
  invalid or expired links show visible retry feedback. The callback retains
  legacy PKCE and token-hash support.
- 2026-08-19: replaced the demo seed with the final participant-free cutover:
  100 spreadsheet-sourced challenges with full proof descriptions, exact 2/3-
  team group sizes, the two subjective bonuses documented for manual RA award,
  ten named RA allowlist entries, and one shared teamless admin account.
- 2026-07-23: added tap-to-call on-campus and off-campus emergency contacts to
  participant Home and the Guide.
- 2026-07-15: reordered participant navigation to Home, Guide, Tasks, then
  Leaderboard on both mobile and desktop.
- 2026-07-15: moved the participant Home guide card directly below the team
  summary on mobile/stacked layouts while retaining the desktop sidebar order.
- 2026-07-15: added an under-5-MB video compression recommendation to the
  submission form and Guide without changing the enforced 50 MB limit.
- 2026-07-15: split the desktop Guide FAQ into independent columns so opening
  one disclosure never stretches or distorts a closed card beside it.
- 2026-07-15: removed completed signup/onboarding steps from the authenticated
  Guide and Home guide card; the participant help page now starts with gameplay.
- 2026-07-15: added a prominent event-guide card to participant Home, including
  the no-team state, so onboarding and troubleshooting are not nav-only.
- 2026-07-15: fixed the landing-page prize sentence to preserve the explicit
  JSX space between the top-eight count and "teams".
- 2026-07-15: added a participant Guide covering the task-to-coins loop, group
  challenges, media rules, and common team/submission troubleshooting; signup
  separately explains its NUSync and RA-roster prerequisites.
- 2026-07-15: renamed the event to **PGPals: The Emerald Challenge**.
- 2026-07-15: submission forms warn that AI-generated media is screened and
  may be rejected.
- 2026-07-15: group challenges now support an exact 2, 3, or custom 4–20 teams,
  with acceptance required from every invited team.
- 2026-07-15: removed repeat approvals; every task or group has one approval.
- 2026-07-15: removed the legacy `max_submissions`, `team_a`, and `team_b`
  columns; award previews now use the database's authoritative calculation.
- 2026-07-15: added mixed photo/video proof, RA video playback, and
  database-enforced media formats/counts.
- 2026-07-15: replaced direct participant media uploads with database-reserved
  batches, signed upload tokens, actual Storage metadata verification, and
  server-side cleanup for failed/expired batches.

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
