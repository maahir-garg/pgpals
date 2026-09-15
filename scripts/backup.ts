/**
 * Point-in-time backup of a PGPals database to ./backups/<host>/<timestamp>/:
 *   tables.json      every app table, all rows
 *   auth-users.json  auth users (id/email/metadata - passwords are not
 *                    exportable; a restore means users reset passwords)
 *   media/           submission media grouped by team, task, and submission
 *   media-manifest.csv
 *                    readable index that maps exports to Storage paths
 *   README.txt       sharing and folder-layout notes
 *
 * Run: npm run backup          (local stack, via .env.local)
 *      npm run backup:prod     (production, via .env.production.local)
 *      npx tsx scripts/backup.ts --prod --photos
 *      npx tsx scripts/backup.ts --prod --photos --resume <backup-folder>
 *
 * Read-only: this script never writes to the database.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const PROD = process.argv.includes("--prod");
const WITH_PHOTOS = process.argv.includes("--photos");
const resumeIndex = process.argv.indexOf("--resume");
const resumePath = resumeIndex >= 0 ? process.argv[resumeIndex + 1] : undefined;
if (resumeIndex >= 0 && (!resumePath || resumePath.startsWith("--"))) {
  console.error("Pass the existing backup folder after --resume.");
  process.exit(1);
}
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
const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = [
  "event_settings",
  "admin_allowlist",
  "teams",
  "roster",
  "profiles",
  "tasks",
  "pairings",
  "submissions",
  "submission_upload_batches",
  "bonus_awards",
  "announcements",
] as const;

const host = new URL(url).host.replace(/[:.]/g, "-");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = resumePath
  ? resolve(process.cwd(), resumePath)
  : join(process.cwd(), "backups", host, stamp);
mkdirSync(outDir, { recursive: true });

type TeamRow = { id: string; name: string };
type TaskRow = { id: string; title: string };
type PairingRow = { id: string; team_ids: string[] };
type SubmissionRow = {
  id: string;
  task_id: string;
  team_id: string;
  pairing_id: string | null;
  text_content: string;
  photo_paths: string[];
  status: string;
  points_awarded: number | null;
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

type MediaManifestRow = {
  exported_file: string;
  storage_path: string;
  attachment_number: number;
  submission_id: string;
  submitted_at_sgt: string;
  submission_status: string;
  task_id: string;
  task_title: string;
  submitting_team_id: string;
  submitting_team_name: string;
  pairing_id: string;
  participating_team_ids: string;
  participating_team_names: string;
  submission_text: string;
  points_awarded: number | "";
  review_note: string;
  reviewed_at: string;
};

function safeSegment(value: string, fallback: string, maxLength = 120) {
  const cleaned = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .trim();
  return Array.from(cleaned || fallback).slice(0, maxLength).join("");
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatSgt(value: string, forFolder = false) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";
  const timeSeparator = forFolder ? "-" : ":";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}${timeSeparator}${part("minute")}${timeSeparator}${part("second")} SGT`;
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(path: string, rows: MediaManifestRow[]) {
  const headers = Object.keys(rows[0] ?? ({
    exported_file: "",
    storage_path: "",
    attachment_number: "",
    submission_id: "",
    submitted_at_sgt: "",
    submission_status: "",
    task_id: "",
    task_title: "",
    submitting_team_id: "",
    submitting_team_name: "",
    pairing_id: "",
    participating_team_ids: "",
    participating_team_names: "",
    submission_text: "",
    points_awarded: "",
    review_note: "",
    reviewed_at: "",
  } satisfies Record<keyof MediaManifestRow, string>));
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvCell(row[header as keyof MediaManifestRow])).join(",")
    ),
  ];
  writeFileSync(path, `\uFEFF${lines.join("\n")}\n`);
}

async function downloadMedia(storagePath: string) {
  let lastError = "Unknown download error";
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { data, error } = await db.storage
      .from("submissions")
      .download(storagePath);
    if (data && !error) return data;
    lastError = error?.message ?? lastError;
    if (attempt < 5) {
      await new Promise((resolveWait) => setTimeout(resolveWait, attempt * 300));
    }
  }
  throw new Error(lastError);
}

async function dumpTable(table: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return rows;
}

async function dumpAuthUsers(): Promise<unknown[]> {
  const users: unknown[] = [];
  for (let pageNum = 1; ; pageNum++) {
    const { data, error } = await db.auth.admin.listUsers({
      page: pageNum,
      perPage: 500,
    });
    if (error) throw new Error(`auth users: ${error.message}`);
    users.push(
      ...data.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        user_metadata: u.user_metadata,
      }))
    );
    if (data.users.length < 500) break;
  }
  return users;
}

async function main() {
  let tables: Record<string, unknown[]>;
  if (resumePath) {
    if (!WITH_PHOTOS) {
      throw new Error("--resume is only supported with --photos.");
    }
    const tablePath = join(outDir, "tables.json");
    const authPath = join(outDir, "auth-users.json");
    if (!existsSync(tablePath) || !existsSync(authPath)) {
      throw new Error("The resume folder must contain tables.json and auth-users.json.");
    }
    tables = JSON.parse(readFileSync(tablePath, "utf8")) as Record<string, unknown[]>;
    console.log(`Resuming media backup for ${new URL(url!).host} → ${outDir}`);
  } else {
    console.log(`Backing up ${new URL(url!).host} → ${outDir}`);
    tables = {};
    for (const table of TABLES) {
      tables[table] = await dumpTable(table);
      console.log(`  ${table}: ${tables[table].length} rows`);
    }
    writeFileSync(join(outDir, "tables.json"), JSON.stringify(tables, null, 1));

    const users = await dumpAuthUsers();
    writeFileSync(join(outDir, "auth-users.json"), JSON.stringify(users, null, 1));
    console.log(`  auth users: ${users.length}`);
  }

  if (WITH_PHOTOS) {
    const mediaDir = join(outDir, "media");
    mkdirSync(mediaDir, { recursive: true });
    const teams = new Map(
      (tables.teams as TeamRow[]).map((team) => [team.id, team])
    );
    const tasks = new Map(
      (tables.tasks as TaskRow[]).map((task) => [task.id, task])
    );
    const pairings = new Map(
      (tables.pairings as PairingRow[]).map((pairing) => [pairing.id, pairing])
    );
    const manifest: MediaManifestRow[] = [];
    const submissions = tables.submissions as SubmissionRow[];
    const jobs: Array<{
      storagePath: string;
      destination: string;
      manifestRow: MediaManifestRow;
    }> = [];
    let saved = 0;
    let failed = 0;

    for (const submission of submissions) {
      const task = tasks.get(submission.task_id);
      const submittingTeam = teams.get(submission.team_id);
      const pairing = submission.pairing_id
        ? pairings.get(submission.pairing_id)
        : undefined;
      const participatingTeamIds = pairing?.team_ids?.length
        ? pairing.team_ids
        : [submission.team_id];
      const participatingTeamNames = participatingTeamIds.map(
        (teamId) => teams.get(teamId)?.name ?? `Unknown team ${shortId(teamId)}`
      );
      const teamBase = pairing
        ? `Group - ${participatingTeamNames.join(" + ")}`
        : submittingTeam?.name ?? `Unknown team ${shortId(submission.team_id)}`;
      const teamFolder = safeSegment(
        `${teamBase} [${shortId(pairing?.id ?? submission.team_id)}]`,
        `Unknown team [${shortId(submission.team_id)}]`
      );
      const taskFolder = safeSegment(
        `${task?.title ?? "Unknown task"} [${shortId(submission.task_id)}]`,
        `Unknown task [${shortId(submission.task_id)}]`
      );
      const submissionFolder = safeSegment(
        `${formatSgt(submission.submitted_at, true)} - ${submission.status} [${shortId(submission.id)}]`,
        `Submission [${shortId(submission.id)}]`
      );
      const destinationDir = join(mediaDir, teamFolder, taskFolder, submissionFolder);
      mkdirSync(destinationDir, { recursive: true });

      for (const [index, storagePath] of (submission.photo_paths ?? []).entries()) {
        const extension = extname(storagePath).toLowerCase() || ".bin";
        const filename = `${String(index + 1).padStart(2, "0")}${extension}`;
        const destination = join(destinationDir, filename);
        const manifestRow: MediaManifestRow = {
            exported_file: relative(outDir, destination),
            storage_path: storagePath,
            attachment_number: index + 1,
            submission_id: submission.id,
            submitted_at_sgt: formatSgt(submission.submitted_at),
            submission_status: submission.status,
            task_id: submission.task_id,
            task_title: task?.title ?? "Unknown task",
            submitting_team_id: submission.team_id,
            submitting_team_name: submittingTeam?.name ?? "Unknown team",
            pairing_id: submission.pairing_id ?? "",
            participating_team_ids: participatingTeamIds.join(" | "),
            participating_team_names: participatingTeamNames.join(" | "),
            submission_text: submission.text_content ?? "",
            points_awarded: submission.points_awarded ?? "",
            review_note: submission.review_note ?? "",
            reviewed_at: submission.reviewed_at ?? "",
        };
        if (existsSync(destination) && statSync(destination).size > 0) {
          manifest.push(manifestRow);
          saved++;
        } else {
          jobs.push({ storagePath, destination, manifestRow });
        }
      }
    }

    const mediaCount = saved + jobs.length;
    if (saved > 0) {
      console.log(`  media: ${saved}/${mediaCount} already present; ${jobs.length} to download`);
    }

    let nextJob = 0;
    async function worker() {
      for (;;) {
        const jobIndex = nextJob++;
        const job = jobs[jobIndex];
        if (!job) return;
        try {
          const data = await downloadMedia(job.storagePath);
          writeFileSync(job.destination, Buffer.from(await data.arrayBuffer()));
          manifest.push(job.manifestRow);
          saved++;
        } catch (error) {
          failed++;
          const message = error instanceof Error ? error.message : String(error);
          console.error(`  FAILED media ${saved + failed}/${mediaCount}: ${job.storagePath} (${message})`);
        }
        const completed = saved + failed;
        if (completed % 50 === 0 || completed === mediaCount) {
          console.log(`  media progress: ${completed}/${mediaCount}`);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(8, jobs.length) }, () => worker())
    );
    manifest.sort((a, b) => a.exported_file.localeCompare(b.exported_file));
    writeCsv(join(outDir, "media-manifest.csv"), manifest);
    console.log(`  media: ${saved} saved${failed ? `, ${failed} FAILED` : ""}`);
    if (failed > 0) {
      throw new Error(`Incomplete media backup: ${failed} file${failed === 1 ? "" : "s"} failed to download.`);
    }
  } else {
    console.log("  media: skipped (pass legacy --photos flag to include)");
  }

  writeFileSync(
    join(outDir, "README.txt"),
    [
      "PGPals point-in-time backup",
      `Created: ${new Date().toISOString()}`,
      `Source: ${new URL(url!).host}`,
      "",
      "PRIVATE: This backup contains resident names, email addresses, submissions, photos, and videos.",
      "Share it only with authorised colleagues using a restricted Drive folder.",
      "",
      "Contents:",
      "- tables.json: all application table rows.",
      "- auth-users.json: user IDs, emails, and metadata; passwords cannot be exported.",
      ...(WITH_PHOTOS
        ? [
            "- media/: attachments grouped by team/group, task, submission time, and status.",
            "- media-manifest.csv: one row per attachment, including its original Storage path.",
            "- Group submissions list all participating teams in media-manifest.csv.",
          ]
        : ["- Media was not included in this backup."]),
      "",
    ].join("\n")
  );

  console.log(`\nDone. Backup written to ${outDir}`);
}

main().catch((e) => {
  console.error("BACKUP FAILED:", e);
  process.exit(1);
});
