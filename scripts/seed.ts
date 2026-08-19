/**
 * Seeds the final 2026 PGPals event configuration.
 *
 * The operation is destructive and idempotent. It removes every existing
 * participant, team, roster row, submission, pairing, upload reservation,
 * bonus, announcement, task, Auth user, and submission media object. It then
 * installs the final RA allowlist, creates the shared RA account, and inserts
 * the 100 final challenges. No participant, team, submission, or demo fixture
 * is created.
 *
 * Run locally: npm run seed
 * Run against production: npm run seed:prod
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FINAL_RA_ACCOUNTS,
  FINAL_TASKS,
  SHARED_ADMIN_EMAIL,
  SHARED_ADMIN_NAME,
  validateFinalEventData,
} from "./final-event-data";

const PROD = process.argv.includes("--prod");
const envFile = PROD ? ".env.production.local" : ".env.local";

try {
  for (const sourceFile of [envFile, ".env.event.local"]) {
    const env = readFileSync(resolve(process.cwd(), sourceFile), "utf8");
    for (const line of env.split("\n")) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  }
} catch {
  // Environment variables may be supplied by the caller instead.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sharedAdminPassword = process.env.PGPALS_SHARED_ADMIN_PASSWORD;

if (!url || !serviceKey) {
  console.error(
    `Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (${envFile})`
  );
  process.exit(1);
}
if (!sharedAdminPassword) {
  console.error(
    "Missing PGPALS_SHARED_ADMIN_PASSWORD (.env.event.local or process environment)"
  );
  process.exit(1);
}
if (!PROD && !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error(
    `${envFile} points at ${new URL(url).host}, which is not the local stack.\n` +
      "The seed wipes its target. Use `npm run seed:prod` only for the deliberate production cutover."
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EVENT_SETTINGS = {
  event_name: "PGPals: The Emerald Challenge",
  start_at: "2026-08-31T00:00:00+08:00",
  end_at: "2026-09-13T23:59:00+08:00",
  leaderboard_hide_at: "2026-09-08T00:00:00+08:00",
};

function die(step: string, error: unknown): never {
  console.error(`FAILED at ${step}:`, error);
  process.exit(1);
}

async function confirmProdWipe() {
  if (!PROD) return;
  console.log(
    `⚠️  FINAL CUTOVER: wiping ${new URL(url!).host} in 5 seconds — Ctrl-C to abort.`
  );
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 5000));
}

async function wipe() {
  console.log("Removing existing event data, users, and submission media…");

  const { error: storageError } = await db.storage.emptyBucket("submissions");
  if (storageError) die("empty submissions storage", storageError);

  for (const table of [
    "announcements",
    "bonus_awards",
    "submissions",
    "submission_upload_batches",
    "pairings",
    "tasks",
    "roster",
    "teams",
  ]) {
    const { error } = await db.from(table).delete().not("id", "is", null);
    if (error) die(`wipe ${table}`, error);
  }

  // Always re-list page 1 because deletions shift later users forward.
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error) die("list Auth users", error);
    if (data.users.length === 0) break;
    for (const user of data.users) {
      const { error: deleteError } = await db.auth.admin.deleteUser(user.id);
      if (deleteError) die("delete Auth user", deleteError);
    }
  }

  const { error: allowlistError } = await db
    .from("admin_allowlist")
    .delete()
    .not("email", "is", null);
  if (allowlistError) die("reset admin allowlist", allowlistError);
}

async function seedAdminAccess() {
  console.log("Installing the final RA allowlist and shared admin account…");
  const allowlist = [
    ...FINAL_RA_ACCOUNTS.map((ra) => ({ email: ra.email })),
    { email: SHARED_ADMIN_EMAIL },
  ];
  const { error: allowlistError } = await db.from("admin_allowlist").insert(allowlist);
  if (allowlistError) die("insert final admin allowlist", allowlistError);

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email: SHARED_ADMIN_EMAIL,
    password: sharedAdminPassword,
    email_confirm: true,
    user_metadata: { full_name: SHARED_ADMIN_NAME },
  });
  if (authError) die("create shared admin Auth user", authError);

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, role, team_id")
    .eq("id", authData.user.id)
    .single();
  if (profileError) die("load shared admin profile", profileError);
  if (profile.role !== "admin" || profile.team_id !== null) {
    die("verify shared admin profile", "Shared account was not created as a teamless admin.");
  }

  return profile.id;
}

async function seedTasks(createdBy: string) {
  console.log("Inserting 100 final challenges…");
  const rows = FINAL_TASKS.map((item) => ({
    title: item.title,
    description: item.description,
    points: item.points,
    type: item.type,
    pair_team_count: item.pairTeamCount,
    release_at: `${item.startDate}T00:00:00+08:00`,
    deadline_at: `${item.endDate}T23:59:00+08:00`,
    bonus_config: item.bonusConfig,
    is_published: true,
    created_by: createdBy,
  }));

  const { data, error } = await db.from("tasks").insert(rows).select("id");
  if (error) die("insert final tasks", error);
  if (data.length !== FINAL_TASKS.length) {
    die("verify inserted tasks", `Expected ${FINAL_TASKS.length}; inserted ${data.length}.`);
  }
}

async function verifyFinalState() {
  const expectedEmptyTables = [
    "teams",
    "roster",
    "submissions",
    "pairings",
    "submission_upload_batches",
    "bonus_awards",
    "announcements",
  ];
  for (const table of expectedEmptyTables) {
    const { count, error } = await db
      .from(table)
      .select("id", { count: "exact", head: true });
    if (error) die(`count ${table}`, error);
    if (count !== 0) die(`verify ${table}`, `Expected 0 rows; found ${count}.`);
  }

  const { data: taskRows, count: taskCount, error: taskError } = await db
    .from("tasks")
    .select("type, pair_team_count, bonus_config, is_published", { count: "exact" });
  if (taskError) die("count tasks", taskError);
  if (taskCount !== 100) die("verify tasks", `Expected 100 rows; found ${taskCount}.`);
  if (taskRows.some((task) => !task.is_published)) {
    die("verify tasks", "Every final task must be published.");
  }
  if (taskRows.filter((task) => task.type === "pair").length !== 10) {
    die("verify tasks", "Expected exactly 10 group tasks.");
  }
  if (
    taskRows.some(
      (task) =>
        (task.type === "pair" && ![2, 3].includes(task.pair_team_count)) ||
        task.bonus_config !== null
    )
  ) {
    die("verify tasks", "Unexpected group size or automatic bonus configuration.");
  }

  const { data: allowlistRows, count: allowlistCount, error: allowlistError } = await db
    .from("admin_allowlist")
    .select("email", { count: "exact" });
  if (allowlistError) die("count admin allowlist", allowlistError);
  if (allowlistCount !== FINAL_RA_ACCOUNTS.length + 1) {
    die(
      "verify admin allowlist",
      `Expected ${FINAL_RA_ACCOUNTS.length + 1} rows; found ${allowlistCount}.`
    );
  }
  const expectedEmails = [
    ...FINAL_RA_ACCOUNTS.map((ra) => ra.email),
    SHARED_ADMIN_EMAIL,
  ].sort();
  const actualEmails = allowlistRows.map((row) => row.email).sort();
  if (JSON.stringify(actualEmails) !== JSON.stringify(expectedEmails)) {
    die("verify admin allowlist", "The allowlist emails do not match the final list.");
  }

  const { data: authUsers, error: authError } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });
  if (authError) die("verify Auth users", authError);
  if (
    authUsers.users.length !== 1 ||
    authUsers.users[0]?.email?.toLowerCase() !== SHARED_ADMIN_EMAIL
  ) {
    die("verify Auth users", "Expected the shared admin to be the only Auth user.");
  }
}

async function main() {
  validateFinalEventData();
  await confirmProdWipe();
  await wipe();

  console.log("Applying final event settings…");
  const { error: settingsError } = await db
    .from("event_settings")
    .update(EVENT_SETTINGS)
    .eq("id", 1);
  if (settingsError) die("update event settings", settingsError);

  const adminId = await seedAdminAccess();
  await seedTasks(adminId);
  await verifyFinalState();

  console.log(`
✅ Final event seed complete.

  Final challenges: 100 (50 in Week 1, 50 in Week 2)
  RA allowlist:     ${FINAL_RA_ACCOUNTS.length} named RAs + 1 shared admin
  Auth users:       1 shared admin
  Teams/roster:     empty and ready for the final import
  Activity data:    empty

  Shared admin email: ${SHARED_ADMIN_EMAIL}
  The password is loaded from PGPALS_SHARED_ADMIN_PASSWORD and is not printed.
`);
}

main().catch((error) => die("main", error));
