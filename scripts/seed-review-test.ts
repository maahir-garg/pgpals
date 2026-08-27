/**
 * Adds a representative, media-heavy RA review queue to the local stack.
 *
 * This script is deliberately separate from the final event seed. It reads
 * only .env.local, refuses non-loopback Supabase URLs, and replaces only its
 * own prefixed fixtures. Run `npm run seed` first so the normal schema, event
 * settings, and final challenge data exist.
 *
 * Run:    npm run seed:review-test
 * Remove: npm run seed:review-test -- --clean
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const CLEAN_ONLY = process.argv.includes("--clean");
const TEAM_PREFIX = "[Review Test] Team";
const TASK_PREFIX = "[Review Test] Queue Task";
const STORAGE_PREFIX = "_review-load";
const BUCKET = "submissions";
const TEAM_COUNT = 60;
const PENDING_COUNT = 50;
const REVIEWED_COUNT = 10;
const ATTACHMENTS_PER_PENDING = 5;

const LOCAL_RA = {
  email: "review.ra@pgpals.local",
  password: "LocalReviewRA2026!",
  fullName: "Review Test RA",
};

const LOCAL_PARTICIPANT = {
  email: "review.participant@pgpals.local",
  password: "LocalReviewPlayer2026!",
  fullName: "Review Test Top 20 Participant",
};

const LOCAL_OUTSIDE_PARTICIPANT = {
  email: "review.outside20@pgpals.local",
  password: "LocalOutside20Player2026!",
  fullName: "Review Test Outside Top 20 Participant",
};

// One second of a plain violet VP9/WebM test clip generated specifically for
// this fixture. Keeping it inline avoids requiring ffmpeg on every developer
// machine while still giving the review queue a valid, playable video.
const TEST_VIDEO = Buffer.from(
  "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAQ5EU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEkTbuMU6uEHFO7a1OsggQj7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjIuMy4xMDBXQYxMYXZmNjIuMy4xMDBEiYhAj0AAAAAAABZUrmvJrgEAAAAAAABA14EBc8WIY21dB1xxm9CcgQAitZyDdW5kiIEAhoVWX1ZQOYOBASPjg4QCYloA4JGwggFAuoG0moECVbCEVbmBARJUw2dAf3Nzn2PAgGfImUWjh0VOQ09ERVJEh4xMYXZmNjIuMy4xMDBzc9pjwItjxYhjbV0HXHGb0GfIpUWjh0VOQ09ERVJEh5hMYXZjNjIuMTEuMTAwIGxpYnZweC12cDlnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjAxLjAwMDAwMDAwMAAfQ7Z1QnTngQCjr4EAAICCSYNCABPwCzYAOCQcGHIAADBgAAB8vbyoM///4AEH4AywZKU8mLrt9NEAo5aBACgAhgBAkpwATkAAAyAAAFo1F64Qo5aBAFAAhgBAkpwAV0AAAyAAAFo1F64Qo5aBAHgAhgBAkpwAT0AAAyAAAFo1F64Qo5aBAKAAhgBAkpwATcAAAyAAAFo1F64Qo5aBAMgAhgBAkpwATQAAAyAAAFo1F64Qo5aBAPAAhgBAkpwATEAAAyAAAFo1F64Qo5aBARgAhgBAkpwAS2AAAyAAAFo1F64Qo5aBAUAAhgBAkpwASmAAAyAAAFo1F64Qo5aBAWgAhgBAkpwASUAAAyAAAFo1F64Qo5aBAZAAhgDAkpwARQAAAyAAAFo1F64Qo5aBAbgAhgBAkpwASCAAAyAAAFo1F64Qo5aBAeAAhgBAkpwAR0AAAyAAAFo1F64Qo5aBAggAhgBAkpwARqAAAyAAAFo1F64Qo5aBAjAAhgBAkpwARgAAAyAAAFo1F64Qo5aBAlgAhgBAkpwARYAAAyAAAFo1F64Qo5aBAoAAhgBAkpwARSAAAyAAAFo1F64Qo5aBAqgAhgBAkpwARKAAAyAAAFo1F64Qo5aBAtAAhgBAkpwAREAAAyAAAFo1F64Qo5aBAvgAhgBAkpwAQ+AAAyAAAFo1F64Qo5aBAyAAhgDAkpwAQeAAAyAAAFo1F64Qo5aBA0gAhgBAkpwAQ4AAAyAAAFo1F64Qo5aBA3AAhgBAkpwAQ0AAAyAAAFo1F64Qo5aBA5gAhgBAkpwAQwAAAyAAAFo1F64Qo5aBA8AAhgBAkpwAQsAAAyAAAFo1F64QHFO7a5G7j7OBALeK94EB8YIBqfCBAw==",
  "base64"
);

try {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {
  // Environment variables may be supplied by the caller instead.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey || (!CLEAN_ONLY && !publishableKey)) {
  console.error(
    "Missing local NEXT_PUBLIC_SUPABASE_URL, publishable key, or service-role key."
  );
  process.exit(1);
}

let target: URL;
try {
  target = new URL(url);
} catch {
  console.error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  process.exit(1);
}

if (!["127.0.0.1", "localhost"].includes(target.hostname)) {
  console.error(
    `Refusing to create review fixtures on ${target.host}. This command is local-only.`
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type TeamRow = { id: string; name: string };
type TaskRow = { id: string; title: string; points: number };
type MediaUpload = { path: string; bytes: Buffer; contentType: string };

function die(step: string, error: unknown): never {
  console.error(`FAILED at ${step}:`, error);
  process.exit(1);
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function listReviewStorage(prefix = STORAGE_PREFIX): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) die(`list Storage folder ${prefix}`, error);
    if (!data || data.length === 0) break;

    for (const item of data) {
      const path = `${prefix}/${item.name}`;
      if (item.id) paths.push(path);
      else paths.push(...(await listReviewStorage(path)));
    }

    if (data.length < 100) break;
    offset += data.length;
  }

  return paths;
}

async function removeMedia(paths: string[]) {
  const uniquePaths = [...new Set(paths)];
  for (const batch of chunks(uniquePaths, 100)) {
    const { error } = await db.storage.from(BUCKET).remove(batch);
    if (error) die("remove review fixture media", error);
  }
}

async function deleteTestUsers() {
  const matches: { id: string; email?: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (error) die("list local Auth users", error);
    matches.push(
      ...data.users
        .filter((user) =>
          [
            LOCAL_RA.email,
            LOCAL_PARTICIPANT.email,
            LOCAL_OUTSIDE_PARTICIPANT.email,
          ].includes(
            user.email?.toLowerCase() ?? ""
          )
        )
        .map((user) => ({ id: user.id, email: user.email }))
    );
    if (data.users.length < 100) break;
  }

  for (const user of matches) {
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) die(`delete local Auth user ${user.email}`, error);
  }
}

async function cleanup() {
  console.log("Removing previous review-test fixtures…");

  const { data: teamData, error: teamError } = await db
    .from("teams")
    .select("id, name")
    .like("name", `${TEAM_PREFIX}%`);
  if (teamError) die("find review-test teams", teamError);
  const teamIds = (teamData ?? []).map((team) => team.id as string);

  let submissionPaths: string[] = [];
  if (teamIds.length > 0) {
    const { data: submissionData, error: submissionError } = await db
      .from("submissions")
      .select("photo_paths")
      .in("team_id", teamIds);
    if (submissionError) die("find review-test submissions", submissionError);
    submissionPaths = (submissionData ?? []).flatMap(
      (submission) => submission.photo_paths as string[]
    );
  }

  const fixturePaths = await listReviewStorage();
  await removeMedia([...submissionPaths, ...fixturePaths]);

  if (teamIds.length > 0) {
    const { error: submissionError } = await db
      .from("submissions")
      .delete()
      .in("team_id", teamIds);
    if (submissionError) die("delete review-test submissions", submissionError);
  }

  const { data: taskData, error: taskError } = await db
    .from("tasks")
    .select("id")
    .like("title", `${TASK_PREFIX}%`);
  if (taskError) die("find review-test tasks", taskError);
  const taskIds = (taskData ?? []).map((task) => task.id as string);
  if (taskIds.length > 0) {
    const { error } = await db.from("tasks").delete().in("id", taskIds);
    if (error) die("delete review-test tasks", error);
  }

  await deleteTestUsers();

  const { error: allowlistError } = await db
    .from("admin_allowlist")
    .delete()
    .eq("email", LOCAL_RA.email);
  if (allowlistError) die("delete review-test RA allowlist", allowlistError);

  if (teamIds.length > 0) {
    const { error } = await db.from("teams").delete().in("id", teamIds);
    if (error) die("delete review-test teams", error);
  }
}

async function createRa(): Promise<string> {
  const { error: allowlistError } = await db
    .from("admin_allowlist")
    .insert({ email: LOCAL_RA.email });
  if (allowlistError) die("allowlist review-test RA", allowlistError);

  const { data, error } = await db.auth.admin.createUser({
    email: LOCAL_RA.email,
    password: LOCAL_RA.password,
    email_confirm: true,
    user_metadata: { full_name: LOCAL_RA.fullName },
  });
  if (error || !data.user) die("create review-test RA", error ?? "No user returned");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, role, team_id")
    .eq("id", data.user.id)
    .single();
  if (profileError) die("verify review-test RA profile", profileError);
  if (profile.role !== "admin" || profile.team_id !== null) {
    die("verify review-test RA profile", "Expected a teamless admin profile.");
  }
  return data.user.id;
}

async function createTasks(adminId: string): Promise<TaskRow[]> {
  const now = Date.now();
  const rows = Array.from({ length: 5 }, (_, index) => ({
    title: `${TASK_PREFIX} ${index + 1}`,
    description:
      "Local-only media-load fixture. Review the proof and exercise approve/reject controls.",
    points: 20 + index * 5,
    type: "standard",
    release_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    deadline_at: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
    bonus_config: null,
    is_published: true,
    created_by: adminId,
  }));
  const { data, error } = await db
    .from("tasks")
    .insert(rows)
    .select("id, title, points");
  if (error) die("create review-test tasks", error);
  return (data ?? []).sort((a, b) => a.title.localeCompare(b.title)) as TaskRow[];
}

async function createTeams(): Promise<TeamRow[]> {
  const rows = Array.from({ length: TEAM_COUNT }, (_, index) => ({
    name: `${TEAM_PREFIX} ${String(index + 1).padStart(2, "0")}`,
  }));
  const { data, error } = await db.from("teams").insert(rows).select("id, name");
  if (error) die("create review-test teams", error);
  return (data ?? []).sort((a, b) => a.name.localeCompare(b.name)) as TeamRow[];
}

async function createParticipant(
  account: typeof LOCAL_PARTICIPANT,
  teamId: string
) {
  const { error: rosterError } = await db.from("roster").insert({
    email: account.email,
    full_name: account.fullName,
    team_id: teamId,
  });
  if (rosterError) die("roster review-test participant", rosterError);

  const { data, error } = await db.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: account.fullName },
  });
  if (error || !data.user) {
    die("create review-test participant", error ?? "No user returned");
  }

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("role, team_id")
    .eq("id", data.user.id)
    .single();
  if (profileError) die("verify review-test participant profile", profileError);
  if (profile.role !== "participant" || profile.team_id !== teamId) {
    die("verify review-test participant profile", "Expected the rostered team profile.");
  }
}

async function createTestImage(): Promise<Buffer> {
  const width = 1280;
  const height = 720;
  const pixels = Buffer.alloc(width * height * 3);
  let state = 123456789;
  for (let index = 0; index < pixels.length; index++) {
    state = (1664525 * state + 1013904223) >>> 0;
    pixels[index] = state >>> 24;
  }
  const image = await sharp(pixels, {
    raw: { width, height, channels: 3 },
  })
    .jpeg({ quality: 55, mozjpeg: true })
    .toBuffer();
  if (image.length > 2 * 1024 * 1024) {
    die("generate review-test image", "Generated image exceeds the 2 MB limit.");
  }
  return image;
}

async function uploadMedia(items: MediaUpload[]) {
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    for (;;) {
      const index = nextIndex++;
      if (index >= items.length) return;
      const item = items[index];
      const { error } = await db.storage.from(BUCKET).upload(item.path, item.bytes, {
        contentType: item.contentType,
        cacheControl: "3600",
        upsert: true,
      });
      if (error) die(`upload ${item.path}`, error);
      completed++;
      if (completed % 25 === 0 || completed === items.length) {
        console.log(`  Uploaded ${completed}/${items.length} media objects`);
      }
    }
  }

  await Promise.all(Array.from({ length: 10 }, () => worker()));
}

async function createSubmissions(
  teams: TeamRow[],
  tasks: TaskRow[],
  reviewerId: string
) {
  const image = await createTestImage();
  const media: MediaUpload[] = [];
  const rows = [];
  const now = Date.now();

  for (let index = 0; index < PENDING_COUNT; index++) {
    const team = teams[index];
    const task = tasks[index % tasks.length];
    const paths: string[] = [];
    const includesVideo = (index + 1) % 5 === 0;

    for (let attachment = 0; attachment < ATTACHMENTS_PER_PENDING; attachment++) {
      const isVideo = includesVideo && attachment === ATTACHMENTS_PER_PENDING - 1;
      const extension = isVideo ? "webm" : "jpg";
      const path = `${STORAGE_PREFIX}/${team.id}/pending-${index + 1}/${attachment + 1}.${extension}`;
      paths.push(path);
      media.push({
        path,
        bytes: isVideo ? TEST_VIDEO : image,
        contentType: isVideo ? "video/webm" : "image/jpeg",
      });
    }

    rows.push({
      task_id: task.id,
      team_id: team.id,
      pairing_id: null,
      text_content: `Pending review fixture ${index + 1}. Five attachments exercise the full queue media budget.`,
      photo_paths: paths,
      status: "pending",
      submitted_at: new Date(now - (PENDING_COUNT - index) * 60_000).toISOString(),
    });
  }

  for (let index = 0; index < REVIEWED_COUNT; index++) {
    const team = teams[PENDING_COUNT + index];
    const task = tasks[index % tasks.length];
    const path = `${STORAGE_PREFIX}/${team.id}/reviewed-${index + 1}/1.jpg`;
    const approved = index < REVIEWED_COUNT / 2;
    media.push({ path, bytes: image, contentType: "image/jpeg" });
    rows.push({
      task_id: task.id,
      team_id: team.id,
      pairing_id: null,
      text_content: `${approved ? "Approved" : "Rejected"} review fixture ${index + 1}.`,
      photo_paths: [path],
      status: approved ? "approved" : "rejected",
      points_awarded: approved ? task.points : null,
      reviewer_id: reviewerId,
      review_note: approved ? null : "Local test rejection: proof needs a clearer photo.",
      submitted_at: new Date(now - (PENDING_COUNT + index + 1) * 60_000).toISOString(),
      reviewed_at: new Date(now - index * 30_000).toISOString(),
    });
  }

  console.log(
    `Uploading ${media.length} private media objects (${Math.round((media.length * image.length) / 1024 / 1024)} MB upper estimate)…`
  );
  await uploadMedia(media);

  const { error } = await db.from("submissions").insert(rows);
  if (error) die("create review-test submissions", error);

  return { imageBytes: image.length, mediaCount: media.length };
}

async function verifyAccounts() {
  for (const account of [
    LOCAL_RA,
    LOCAL_PARTICIPANT,
    LOCAL_OUTSIDE_PARTICIPANT,
  ]) {
    const client = createClient(url!, publishableKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (error) die(`verify login ${account.email}`, error);

    const { data: leaderboardData, error: leaderboardError } = await client.rpc(
      "get_leaderboard"
    );
    if (leaderboardError) die(`verify leaderboard ${account.email}`, leaderboardError);
    const leaderboard = (leaderboardData ?? []) as Array<{
      rank: number;
      is_mine: boolean;
    }>;

    if (account === LOCAL_RA) {
      if (leaderboard.length !== TEAM_COUNT) {
        die("verify RA full leaderboard", `Expected ${TEAM_COUNT} rows.`);
      }
      continue;
    }

    const own = leaderboard.find((row) => row.is_mine);
    if (!own) die(`verify own leaderboard row ${account.email}`, "Row missing.");

    if (account === LOCAL_PARTICIPANT && own.rank > 20) {
      die("verify top-20 participant", `Expected rank at most 20, got ${own.rank}.`);
    }
    if (
      account === LOCAL_OUTSIDE_PARTICIPANT &&
      (own.rank <= 20 ||
        leaderboard.length !== 21 ||
        leaderboard.filter((row) => row.rank > 20).length !== 1)
    ) {
      die(
        "verify outside-top-20 participant",
        `Expected top 20 plus one own row, got rank ${own.rank} across ${leaderboard.length} rows.`
      );
    }
  }
}

async function verifyState(teamIds: string[]) {
  const { data, count, error } = await db
    .from("submissions")
    .select("status", { count: "exact" })
    .in("team_id", teamIds);
  if (error) die("verify review-test submissions", error);

  const counts = new Map<string, number>();
  for (const submission of data ?? []) {
    counts.set(submission.status, (counts.get(submission.status) ?? 0) + 1);
  }
  if (
    count !== PENDING_COUNT + REVIEWED_COUNT ||
    counts.get("pending") !== PENDING_COUNT ||
    counts.get("approved") !== REVIEWED_COUNT / 2 ||
    counts.get("rejected") !== REVIEWED_COUNT / 2
  ) {
    die("verify review-test submissions", { count, counts: Object.fromEntries(counts) });
  }

  await verifyAccounts();
}

async function main() {
  await cleanup();
  if (CLEAN_ONLY) {
    console.log("✅ Review-test fixtures removed. Final event seed data was untouched.");
    return;
  }

  console.log("Creating local review-test accounts, teams, and tasks…");
  const reviewerId = await createRa();
  const tasks = await createTasks(reviewerId);
  const teams = await createTeams();
  if (tasks.length !== 5 || teams.length !== TEAM_COUNT) {
    die("verify fixture setup", `Expected 5 tasks and ${TEAM_COUNT} teams.`);
  }
  await createParticipant(LOCAL_PARTICIPANT, teams[0].id);
  await createParticipant(LOCAL_OUTSIDE_PARTICIPANT, teams[TEAM_COUNT - 1].id);
  const media = await createSubmissions(teams, tasks, reviewerId);
  await verifyState(teams.map((team) => team.id));

  console.log(`
✅ Local RA review fixture ready.

  Pending queue:      ${PENDING_COUNT} submissions × ${ATTACHMENTS_PER_PENDING} attachments
  Other review tabs: ${REVIEWED_COUNT / 2} approved + ${REVIEWED_COUNT / 2} rejected
  Private media:      ${media.mediaCount} objects (${Math.round(media.imageBytes / 1024)} KB test photos)

  RA:          ${LOCAL_RA.email}
  Password:    ${LOCAL_RA.password}

  Top 20 participant: ${LOCAL_PARTICIPANT.email}
  Password:           ${LOCAL_PARTICIPANT.password}

  Outside top 20:     ${LOCAL_OUTSIDE_PARTICIPANT.email}
  Password:           ${LOCAL_OUTSIDE_PARTICIPANT.password}

  Remove only these fixtures with: npm run seed:review-test -- --clean
`);
}

main().catch((error) => die("main", error));
