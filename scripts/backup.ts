/**
 * Point-in-time backup of a PGPals database to ./backups/<host>/<timestamp>/:
 *   tables.json      every app table, all rows
 *   auth-users.json  auth users (id/email/metadata - passwords are not
 *                    exportable; a restore means users reset passwords)
 *   photos/          every submission photo/video (with legacy --photos flag)
 *
 * Run: npm run backup          (local stack, via .env.local)
 *      npm run backup:prod     (production, via .env.production.local)
 *      npx tsx scripts/backup.ts --prod --photos
 *
 * Read-only: this script never writes to the database.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const PROD = process.argv.includes("--prod");
const WITH_PHOTOS = process.argv.includes("--photos");
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
const outDir = join(process.cwd(), "backups", host, stamp);
mkdirSync(outDir, { recursive: true });

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
  console.log(`Backing up ${new URL(url!).host} → ${outDir}`);

  const tables: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    tables[table] = await dumpTable(table);
    console.log(`  ${table}: ${tables[table].length} rows`);
  }
  writeFileSync(join(outDir, "tables.json"), JSON.stringify(tables, null, 1));

  const users = await dumpAuthUsers();
  writeFileSync(join(outDir, "auth-users.json"), JSON.stringify(users, null, 1));
  console.log(`  auth users: ${users.length}`);

  if (WITH_PHOTOS) {
    const photoDir = join(outDir, "photos");
    mkdirSync(photoDir, { recursive: true });
    const paths = (tables.submissions as { photo_paths: string[] }[]).flatMap(
      (s) => s.photo_paths ?? []
    );
    let saved = 0;
    let failed = 0;
    for (const path of paths) {
      const { data, error } = await db.storage.from("submissions").download(path);
      if (error || !data) {
        failed++;
        continue;
      }
      const flat = join(photoDir, path.replace(/\//g, "__"));
      writeFileSync(flat, Buffer.from(await data.arrayBuffer()));
      saved++;
    }
    console.log(`  media: ${saved} saved${failed ? `, ${failed} FAILED` : ""}`);
    if (failed > 0) {
      throw new Error(`Incomplete media backup: ${failed} file${failed === 1 ? "" : "s"} failed to download.`);
    }
  } else {
    console.log("  media: skipped (pass legacy --photos flag to include)");
  }

  console.log(`\nDone. Backup written to ${outDir}`);
}

main().catch((e) => {
  console.error("BACKUP FAILED:", e);
  process.exit(1);
});
