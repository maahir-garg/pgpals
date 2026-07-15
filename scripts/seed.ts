/**
 * Seeds the database with realistic demo data:
 *  - 1 dry-run admin + 20 teams (40 rostered residents, most signed up)
 *  - tasks in every state (live, closing soon, closed, scheduled, draft,
 *    pair, every bonus type, multi-submission)
 *  - submissions in every status incl. a rejected→resubmitted chain
 *  - pairings (accepted / pending / declined), manual bonuses, announcements
 *
 * Run: npm run seed   (idempotent: wipes and recreates demo data)
 * All demo passwords: pgpals123
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  LUCKY_DRAW,
  PARTICIPATION_REWARD,
  PRIZE_CEREMONY_LABEL,
  PRIZE_POOL_VALUE_LABEL,
  PRIZE_REVEAL_TEASER,
  PRIZE_TAGLINE,
  PRIZE_WINNER_COUNT,
} from "../src/lib/prizes";

// --- env -------------------------------------------------------------------
// Default target is the LOCAL stack via .env.local, and anything that does
// not look local is refused. `npm run seed:prod` (--prod) loads
// .env.production.local instead, for deliberate dry-run reseeds of the live
// project, with a 5-second abort window: this script WIPES its target.
const PROD = process.argv.includes("--prod");
const envFile = PROD ? ".env.production.local" : ".env.local";
try {
  const env = readFileSync(resolve(process.cwd(), envFile), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* rely on process env */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(`Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (${envFile})`);
  process.exit(1);
}
if (!PROD && !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error(
    `${envFile} points at ${new URL(url).host}, which is not the local stack.\n` +
      "The seed wipes its target. Use `npm run seed:prod` if you really mean it."
  );
  process.exit(1);
}
async function confirmProdWipe() {
  if (!PROD) return;
  console.log(
    `⚠️  WIPING AND RESEEDING ${new URL(url!).host} in 5 seconds - Ctrl-C to abort.`
  );
  await new Promise((r) => setTimeout(r, 5000));
}
const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "pgpals123";
const LOCAL_ADMIN_EMAIL = "ra@pgpals.test";
const PROD_FALLBACK_ADMIN_EMAIL = "ra.dryrun@u.nus.edu";
const hours = (n: number) => new Date(Date.now() + n * 3600_000).toISOString();
const days = (n: number) => hours(n * 24);

// Real 2026 run defaults. Admins can still edit these in Settings; the seed
// just avoids showing a confusing relative demo window on the landing page.
const EVENT_START_AT = "2026-08-31T00:00:00+08:00";
const EVENT_END_AT = "2026-09-13T23:59:00+08:00";
const LEADERBOARD_HIDE_AT = "2026-09-08T00:00:00+08:00";
const EVENT_START_LABEL = "31 August";
const EVENT_END_LABEL = "13 September";
const LEADERBOARD_HIDE_LABEL = "8 September";

// --- demo data -------------------------------------------------------------
const TEAM_NAMES = [
  "Waffle Warriors", "Duck Duck Goose", "The Dumpling Duo", "Chicken Rice Champions",
  "Kaya Toast Krew", "Milo Dinosaurs", "The Otter Pair", "Supper Club",
  "Laksa Legends", "Bubble Tea Bandits", "The Mound Rats", "Roti Prata Party",
  "Satay Squad", "Ice Kachang Icons", "Nasi Lemak Ninjas", "The PGP Penguins",
  "Char Kway Teow Crew", "Kopi Kakis", "The Study Buddies", "Midnight Mamak",
];

const FIRST = ["Chloe", "Wei Ling", "Aisha", "Ryan", "Mei Hui", "Arjun", "Sarah",
  "Jun Jie", "Priya", "Marcus", "Hui Min", "Daniel", "Nadia", "Kai", "Grace",
  "Hafiz", "Xin Yi", "Ethan", "Divya", "Zhi Hao", "Amanda", "Irfan", "Yu Ting",
  "Lucas", "Shreya", "Ming En", "Rachel", "Adam", "Li Ting", "Nikhil", "Cheryl",
  "Farhan", "Jia Wen", "Ben", "Ananya", "Kok Wai", "Elly", "Tejas", "Si Qi", "Owen"];
const LAST = ["Lim", "Tan", "Rahman", "Ng", "Chen", "Menon", "Wong", "Koh", "Nair",
  "Lee", "Goh", "Ong", "Binte Yusof", "Teo", "Chua", "Bin Salleh", "Zhang", "Ho",
  "Pillai", "Liu", "Yeo", "Hussain", "Sim", "Foo", "Iyer", "Toh", "Chan", "Low",
  "Seah", "Sharma", "Ang", "Malik", "Peh", "Tay", "Rao", "Cheong", "Soh", "Patel",
  "Quek", "Yap"];

function residentName(i: number) {
  return `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`;
}
function residentEmail(i: number) {
  const slug = residentName(i).toLowerCase().replace(/[^a-z]+/g, ".");
  return `${slug}@u.nus.edu`;
}

// Teams whose second member hasn't signed up yet (shows ⏳ in admin).
const NOT_SIGNED_UP = new Set([7, 13, 18]);

// --- placeholder photos ----------------------------------------------------
const PALETTES: [string, string, string][] = [
  ["#f97350", "#ffd166", "📸"], ["#06b6a4", "#bbf7d0", "🍜"],
  ["#8b5cf6", "#fbcfe8", "🌅"], ["#f59e0b", "#fef3c7", "🧋"],
  ["#3b82f6", "#dbeafe", "🎬"], ["#ef4444", "#fee2e2", "🧺"],
];

async function makePhoto(index: number): Promise<Buffer> {
  const [bg, fg, emoji] = PALETTES[index % PALETTES.length];
  const svg = `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="600" fill="${bg}"/>
    <circle cx="650" cy="120" r="180" fill="${fg}" opacity="0.6"/>
    <circle cx="120" cy="500" r="140" fill="${fg}" opacity="0.4"/>
    <text x="400" y="330" font-size="160" text-anchor="middle">${emoji}</text>
    <text x="400" y="470" font-size="42" text-anchor="middle" fill="white"
      font-family="Helvetica, Arial" font-weight="bold">PGPals demo photo</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 70 }).toBuffer();
}

// --- helpers ---------------------------------------------------------------
function die(step: string, error: unknown): never {
  console.error(`FAILED at ${step}:`, error);
  process.exit(1);
}

async function wipe() {
  console.log("Wiping existing data…");
  await db.storage.emptyBucket("submissions").catch(() => {});
  for (const table of ["announcements", "bonus_awards", "submissions", "pairings", "tasks", "roster", "teams"]) {
    const { error } = await db.from(table).delete().not("id", "is", null);
    if (error) die(`wipe ${table}`, error);
  }
  // Delete all auth users (cascades to profiles). Always re-list page 1:
  // deletions shift the remaining users forward.
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error) die("listUsers", error);
    if (data.users.length === 0) break;
    for (const user of data.users) {
      await db.auth.admin.deleteUser(user.id);
    }
    if (data.users.length < 100) break;
  }
}

async function main() {
  await confirmProdWipe();
  await wipe();

  // --wipe-only: clean build for the real event (see README "D-day").
  // Leaves event_settings and real admin_allowlist emails in place, but
  // removes the demo admin; RAs sign up again and configure via the UI.
  if (process.argv.includes("--wipe-only")) {
    await db
      .from("admin_allowlist")
      .delete()
      .in("email", [LOCAL_ADMIN_EMAIL, PROD_FALLBACK_ADMIN_EMAIL]);
    console.log(
      "\nWiped clean (no demo data). Next: check Admin → Settings lists the",
      "\nreal RA emails, have them sign up, confirm the event dates, then",
      "\nimport the real roster CSV. See README → D-day."
    );
    return;
  }

  // Event window defaults use the real 2026 run in SGT. Task timings below
  // remain relative so local/demo workflows still have live tasks.
  console.log("Event settings…");
  {
    const { error } = await db
      .from("event_settings")
      .update({
        event_name: "PGPals: The Emerald Challenge",
        start_at: EVENT_START_AT,
        end_at: EVENT_END_AT,
        leaderboard_hide_at: LEADERBOARD_HIDE_AT,
      })
      .eq("id", 1);
    if (error) die("event_settings", error);
  }

  // Teams + roster
  console.log("Teams & roster…");
  const teamIds: string[] = [];
  for (let t = 0; t < TEAM_NAMES.length; t++) {
    const { data: team, error } = await db
      .from("teams")
      .insert({ name: TEAM_NAMES[t] })
      .select("id")
      .single();
    if (error) die(`team ${TEAM_NAMES[t]}`, error);
    teamIds.push(team.id);
    const { error: rosterError } = await db.from("roster").insert([
      { team_id: team.id, full_name: residentName(t * 2), email: residentEmail(t * 2) },
      { team_id: team.id, full_name: residentName(t * 2 + 1), email: residentEmail(t * 2 + 1) },
    ]);
    if (rosterError) die("roster", rosterError);
  }

  // Users: dry-run admin + participants (roster-linked by trigger). We prefer
  // ra@pgpals.test for prod dry runs too, but hosted Auth can reject reserved
  // .test domains, so prod falls back instead of leaving a half-seeded DB.
  console.log("Users (this takes ~30s)…");
  async function createSeedAdmin(email: string): Promise<
    | { ok: true; id: string; email: string }
    | { ok: false; error: string }
  > {
    const { error: allowError } = await db
      .from("admin_allowlist")
      .upsert({ email });
    if (allowError) return { ok: false, error: allowError.message };

    const { error: adminError } = await db.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "RA R3" },
    });
    if (adminError) return { ok: false, error: adminError.message };

    const { data: adminProfile, error: profileError } = await db
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();
    if (profileError || !adminProfile) {
      return {
        ok: false,
        error: profileError?.message ?? "Admin profile was not created.",
      };
    }
    return { ok: true, id: adminProfile.id, email };
  }

  let adminResult = await createSeedAdmin(LOCAL_ADMIN_EMAIL);
  if (!adminResult.ok && PROD) {
    console.warn(
      `Could not create ${LOCAL_ADMIN_EMAIL} on hosted Auth: ${adminResult.error}`
    );
    console.warn(`Falling back to ${PROD_FALLBACK_ADMIN_EMAIL}.`);
    await db.from("admin_allowlist").delete().eq("email", LOCAL_ADMIN_EMAIL);
    adminResult = await createSeedAdmin(PROD_FALLBACK_ADMIN_EMAIL);
  }
  if (!adminResult.ok) die("admin user", adminResult.error);

  const profileIdByEmail = new Map<string, string>();
  for (let i = 0; i < TEAM_NAMES.length * 2; i++) {
    const teamIndex = Math.floor(i / 2);
    if (NOT_SIGNED_UP.has(teamIndex) && i % 2 === 1) continue; // second member never signed up
    const { data, error } = await db.auth.admin.createUser({
      email: residentEmail(i),
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: residentName(i) },
    });
    if (error) die(`user ${residentEmail(i)}`, error);
    profileIdByEmail.set(residentEmail(i), data.user.id);
  }
  const adminId = adminResult.id;

  // Tasks
  console.log("Tasks…");
  async function addTask(row: Record<string, unknown>): Promise<string> {
    const { data, error } = await db
      .from("tasks")
      .insert({ created_by: adminId, ...row })
      .select("id")
      .single();
    if (error) die(`task ${row.title}`, error);
    return data.id;
  }

  const tPenguin = await addTask({
    title: "Find the hidden penguin 🐧",
    description:
      "Somewhere in PGPR there's a tiny penguin statue. Find it and snap a photo of **both of you** with it!\n\n- Both faces visible\n- No spoilers in the group chat!",
    points: 10, type: "standard", release_at: days(-5), deadline_at: days(-2),
  });
  const tSunrise = await addTask({
    title: "Sunrise mission 🌅",
    description: "Catch the sunrise together from anywhere on campus. Photo must show the sky AND both of you (bed hair encouraged).",
    points: 15, type: "standard", release_at: days(-5), deadline_at: days(-1),
  });
  const tDinner = await addTask({
    title: "Dinner date with your pal 🍜",
    description: "Have a meal together somewhere neither of you has eaten before. Show us the food and the new spot!",
    points: 10, type: "standard", release_at: days(-3), deadline_at: days(4),
    bonus_config: { kind: "first_n", n: 10, bonus: 5 },
  });
  const tSweep = await addTask({
    title: "Supermarket sweep 🛒",
    description: "Recreate a famous album cover using only items from the supermarket. Bonus coins for commitment.",
    points: 20, type: "standard", release_at: days(-2), deadline_at: days(5),
    bonus_config: { kind: "before", cutoff: days(1), bonus: 10 },
  });
  const tMovie = await addTask({
    title: "Movie night squad 🎬",
    description: "**Group task!** Link up with two other teams for a movie night: 6 people, 1 screen, snacks mandatory. One submission for all three teams.",
    points: 25, type: "pair", release_at: days(-2), deadline_at: days(6),
    pair_team_count: 3,
    bonus_config: { kind: "multiplier_before", cutoff: days(2), multiplier: 1.5 },
  });
  await addTask({
    title: "Golden hour at the Mound ✨",
    description: "Sunset photo at the PGP Mound. Golden hour is roughly 6.45pm to 7.15pm, so time it right!",
    points: 15, type: "standard", release_at: days(-1), deadline_at: hours(20),
  });
  const tGratitude = await addTask({
    title: "Daily gratitude snap 🙏",
    description: "Photo of one thing you're grateful for today, with a one-line caption.",
    points: 5, type: "standard", release_at: days(-3), deadline_at: days(7),
  });
  const tPicnic = await addTask({
    title: "Pair picnic in the park 🧺",
    description: "**Pair task!** Two teams, one picnic, zero phones (except for the proof photo).",
    points: 20, type: "pair", release_at: days(-1), deadline_at: days(7),
  });
  await addTask({
    title: "Weekend mystery challenge 🎁",
    description: "Releasing this weekend. Keep your Saturday free!",
    points: 30, type: "standard", release_at: days(2), deadline_at: days(6),
  });
  await addTask({
    title: "(Draft) Karaoke showdown 🎤",
    description: "Still planning this one.",
    points: 20, type: "standard", release_at: days(3), deadline_at: days(8),
    is_published: false,
  });

  // Photos
  console.log("Uploading demo photos…");
  const photoBuffers = await Promise.all(PALETTES.map((_, i) => makePhoto(i)));
  let photoCounter = 0;
  async function uploadPhotos(teamId: string, count: number): Promise<string[]> {
    const folder = crypto.randomUUID();
    const paths: string[] = [];
    for (let i = 0; i < count; i++) {
      const path = `${teamId}/${folder}/${i + 1}.jpg`;
      const { error } = await db.storage
        .from("submissions")
        .upload(path, photoBuffers[photoCounter++ % photoBuffers.length], {
          contentType: "image/jpeg",
        });
      if (error) die(`upload ${path}`, error);
      paths.push(path);
    }
    return paths;
  }

  // Submissions
  console.log("Submissions…");
  interface SubSpec {
    task: string; team: string; status: "pending" | "approved" | "rejected" | "superseded";
    points?: number; note?: string; submittedH: number; reviewedH?: number;
    pairing?: string; resubOf?: string; photos?: number; text?: string;
  }
  async function addSub(spec: SubSpec): Promise<string> {
    const paths = await uploadPhotos(spec.team, spec.photos ?? 2);
    const { data, error } = await db
      .from("submissions")
      .insert({
        task_id: spec.task,
        team_id: spec.team,
        pairing_id: spec.pairing ?? null,
        text_content: spec.text ?? "Done! That was so fun 😄",
        photo_paths: paths,
        status: spec.status,
        points_awarded: spec.status === "approved" ? (spec.points ?? 0) : null,
        reviewer_id: spec.status === "pending" ? null : adminId,
        review_note: spec.note ?? null,
        submitted_at: hours(spec.submittedH),
        reviewed_at: spec.reviewedH != null ? hours(spec.reviewedH) : null,
        resubmission_of: spec.resubOf ?? null,
      })
      .select("id")
      .single();
    if (error) die("submission", error);
    return data.id;
  }

  // Closed task: 12 teams approved, varying review times (tie-break variety)
  for (let t = 0; t < 12; t++) {
    await addSub({
      task: tPenguin, team: teamIds[t], status: "approved", points: 10,
      submittedH: -100 - t, reviewedH: -95 - t,
      text: "Found the little guy! 🐧",
    });
  }
  // Sunrise: mix of approved and a rejected that never got resubmitted (closed now)
  for (let t = 0; t < 6; t++) {
    await addSub({
      task: tSunrise, team: teamIds[t], status: "approved", points: 15,
      submittedH: -80 - t, reviewedH: -70 - t, text: "5:45am club ☀️",
    });
  }
  await addSub({
    task: tSunrise, team: teamIds[6], status: "rejected",
    note: "That's clearly a sunset, nice try! 😂", submittedH: -60, reviewedH: -55,
  });

  // Dinner (first_n bonus): 8 approved with +5 bonus, some pending, 1 rejected chain
  for (let t = 0; t < 8; t++) {
    await addSub({
      task: tDinner, team: teamIds[t], status: "approved", points: 15,
      submittedH: -40 - t, reviewedH: -30 - t, text: "New stall unlocked 🍜",
    });
  }
  for (let t = 8; t < 12; t++) {
    await addSub({
      task: tDinner, team: teamIds[t], status: "pending",
      submittedH: -6 - t, text: "Dinner adventure complete!",
    });
  }
  const rejectedDinner = await addSub({
    task: tDinner, team: teamIds[12], status: "superseded",
    note: "We can't see the food. Resubmit with the dishes visible please!",
    submittedH: -30, reviewedH: -26,
  });
  await addSub({
    task: tDinner, team: teamIds[12], status: "pending",
    resubOf: rejectedDinner, submittedH: -3,
    text: "Take two, full spread this time 🍽️",
  });

  // Sweep (before-cutoff bonus): pending queue + one rejected needing action
  for (let t = 2; t < 6; t++) {
    await addSub({
      task: tSweep, team: teamIds[t], status: "pending",
      submittedH: -2 - t, text: "Abbey Road, aisle 4 🛒", photos: 3,
    });
  }
  await addSub({
    task: tSweep, team: teamIds[6], status: "rejected",
    note: "Love it, but we need all 4 grid photos. Add the close-up!",
    submittedH: -20, reviewedH: -12, photos: 1,
  });

  // Gratitude: one approved submission and another team's pending submission.
  await addSub({ task: tGratitude, team: teamIds[0], status: "approved", points: 5, submittedH: -50, reviewedH: -45, photos: 1, text: "Grateful for kopi ☕" });
  await addSub({ task: tGratitude, team: teamIds[1], status: "pending", submittedH: -2, photos: 1, text: "Grateful for my pal 🥹" });

  // Pairings for movie night: accepted+approved joint sub, pending invite, declined
  console.log("Pairings…");
  async function addPairing(
    task: string, teamIds: string[],
    status: "pending" | "accepted" | "declined"
  ): Promise<string> {
    const acceptedTeamIds = status === "accepted" ? teamIds : [teamIds[0]];
    const { data, error } = await db
      .from("pairings")
      .insert({
        task_id: task,
        team_a: teamIds[0],
        team_b: teamIds[1],
        team_ids: teamIds,
        accepted_team_ids: acceptedTeamIds,
        status,
        created_by_team: teamIds[0],
      })
      .select("id")
      .single();
    if (error) die("pairing", error);
    return data.id;
  }

  const movieAccepted = await addPairing(tMovie, [teamIds[0], teamIds[1], teamIds[2]], "accepted");
  await addSub({
    task: tMovie, team: teamIds[0], pairing: movieAccepted,
    status: "approved", points: 38, // 25 × 1.5 rounded
    submittedH: -10, reviewedH: -5, photos: 3,
    text: "Double date movie night, 10/10 would recommend 🍿",
  });
  const moviePending2 = await addPairing(tMovie, [teamIds[3], teamIds[4], teamIds[5]], "accepted");
  await addSub({
    task: tMovie, team: teamIds[3], pairing: moviePending2,
    status: "pending", submittedH: -1, photos: 2,
    text: "Horror night. Half of us watched through fingers 👻",
  });
  await addPairing(tMovie, [teamIds[6], teamIds[7], teamIds[8]], "pending");
  await addPairing(tMovie, [teamIds[9], teamIds[10], teamIds[11]], "declined");
  await addPairing(tPicnic, [teamIds[8], teamIds[2]], "pending");

  // Manual bonuses
  console.log("Bonuses…");
  const { error: bonusError } = await db.from("bonus_awards").insert([
    { team_id: teamIds[1], points: 10, reason: "Best team spirit at the ice cream social", awarded_by: adminId },
    { team_id: teamIds[4], points: 5, reason: "Helped set up movie night for everyone", awarded_by: adminId },
    { team_id: teamIds[9], points: -5, reason: "Late to the scavenger briefing (sorry!)", awarded_by: adminId },
  ]);
  if (bonusError) die("bonus_awards", bonusError);

  // Announcements
  console.log("Announcements…");
  const { error: annError } = await db.from("announcements").insert([
    {
      title: "Welcome to PGPals! 🎉", pinned: true, created_by: adminId,
      body: `PGPals runs ${EVENT_START_LABEL} to ${EVENT_END_LABEL}, all times SGT.\n\nHere's how it works:\n\n1. Complete tasks with your pal\n2. Snap photos as proof\n3. Earn PGP Coins and climb the board\n\n${PRIZE_TAGLINE}\n\nNew tasks drop through the event, so check back often! Questions? Find any RA at the lounge.`,
    },
    {
      title: `${PRIZE_POOL_VALUE_LABEL} prize pool is in play 🎁`, pinned: false, created_by: adminId,
      body: `Top ${PRIZE_WINNER_COUNT} teams win from the tech pool, led by the iPad grand prize. ${PRIZE_REVEAL_TEASER} ${PARTICIPATION_REWARD.blurb} ${LUCKY_DRAW.blurb}`,
    },
    {
      title: "Movie night pair task is live 🎬", pinned: false, created_by: adminId,
      body: "Team up with another duo for **1.5× coins** if you submit in the next two days. The pairing feature is on the task page!",
    },
    {
      title: `Leaderboard goes dark around ${LEADERBOARD_HIDE_LABEL} 🤫`, pinned: false, created_by: adminId,
      body: `The board hides before the final stretch, and final standings are revealed live at the prize ceremony on ${PRIZE_CEREMONY_LABEL}. Make those last coins count!`,
    },
  ]);
  if (annError) die("announcements", annError);

  console.log(`
✅ Seed complete!

  Admin:        ${adminResult.email} / ${PASSWORD}
  Participant:  ${residentEmail(0)} / ${PASSWORD}   (team "${TEAM_NAMES[0]}")
  Participant:  ${residentEmail(24)} / ${PASSWORD}   (team "${TEAM_NAMES[12]}", has a resubmission)
  Not signed up yet (to demo signup): ${residentEmail(15)}

  All ${TEAM_NAMES.length} teams, ${TEAM_NAMES.length * 2 - NOT_SIGNED_UP.size} users share the password ${PASSWORD}.
`);
}

main().catch((e) => die("main", e));
