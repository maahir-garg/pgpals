/**
 * Renders every page of the running dev server (http://localhost:3000) as
 * anon / participant / admin by forging the @supabase/ssr auth cookie from a
 * real signed-in session, and asserts key content appears.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const env = readFileSync(resolve(cwd, ".env.local"), "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const BASE = "http://localhost:3000";

let passed = 0, failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? "✅" : "❌"} ${name}${ok ? "" : ": " + detail}`);
}

// Build the cookie @supabase/ssr expects: sb-<ref>-auth-token = base64-<b64url(json)>
function cookieFor(session: object): string {
  const ref = new URL(url).hostname.split(".")[0]; // "127" locally
  const b64 = Buffer.from(JSON.stringify(session))
    .toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `sb-${ref}-auth-token=base64-${b64}`;
}

async function loginCookie(email: string): Promise<string> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: "pgpals123" });
  if (error || !data.session) throw new Error(`login ${email}: ${error?.message}`);
  return cookieFor(data.session);
}

async function get(path: string, cookie?: string) {
  const res = await fetch(BASE + path, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location") ?? "", body };
}

async function main() {
  const participant = await loginCookie("chloe.lim@u.nus.edu");
  const admin = await loginCookie("ra@pgpals.test");

  console.log("— anon —");
  let r = await get("/");
  check("landing page renders for anon", r.status === 200 && r.body.includes("How it works"), String(r.status));
  check("landing page shows venue", r.body.includes("PGP Residences"));
  r = await get("/dashboard");
  check("anon /dashboard redirects to /login", r.status === 307 && r.location.includes("/login"), `${r.status} ${r.location}`);
  r = await get("/login");
  check("/login renders", r.status === 200 && r.body.includes("PGPals"), String(r.status));
  r = await get("/signup");
  check("/signup renders", r.status === 200 && r.body.includes("email your RA registered"), String(r.status));

  console.log("— participant —");
  r = await get("/dashboard", participant);
  check("dashboard shows team", r.body.includes("Waffle Warriors"), String(r.status));
  check("dashboard shows announcements", r.body.includes("Welcome to PGPals"));
  check("dashboard shows points history", r.body.includes("Points history"));
  r = await get("/tasks", participant);
  check("tasks page groups", r.body.includes("Closing soon") && r.body.includes("Open"), String(r.status));
  check("tasks page shows released task", r.body.includes("Dinner date"));
  check("tasks page hides scheduled task", !r.body.includes("Weekend mystery"));
  const dinnerHref = r.body.match(/href="\/tasks\/([a-f0-9-]+)"/g);
  check("task links exist", !!dinnerHref && dinnerHref.length > 3);
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: "chloe.lim@u.nus.edu", password: "pgpals123" });
  const { data: dinner } = await c.from("tasks").select("id").ilike("title", "%dinner%").single();
  r = await get(`/tasks/${dinner!.id}`, participant);
  check("task detail renders bonus text", r.body.includes("Early bird"), String(r.status));
  check("task detail shows submission form or status", r.body.includes("Submit your proof") || r.body.includes("Your submissions"));
  r = await get("/leaderboard", participant);
  check("leaderboard renders ranks", r.status === 200 && r.body.includes("Your team is #"), String(r.status));
  r = await get("/admin", participant);
  check("participant blocked from /admin", r.status === 307 && r.location.includes("/dashboard"), `${r.status} ${r.location}`);
  r = await get("/", participant);
  check("logged-in / redirects to dashboard", r.status === 307 && r.location.includes("/dashboard"), `${r.status} ${r.location}`);

  console.log("— admin —");
  r = await get("/admin", admin);
  check("admin overview renders", r.body.includes("Pending review"), String(r.status));
  r = await get("/admin/review", admin);
  check("review queue shows pending cards", r.body.includes("Approve"), String(r.status));
  check("review queue shows photos", r.body.includes("supabase") || r.body.includes("sign"));
  r = await get("/admin/tasks", admin);
  check("admin tasks table incl. draft", r.body.includes("Karaoke"), String(r.status));
  check("admin tasks shows states", r.body.includes("Scheduled") && r.body.includes("Live") && r.body.includes("Closed"));
  r = await get("/admin/teams", admin);
  check("admin teams list", r.body.includes("Waffle Warriors"), String(r.status));
  check("signup status shown", r.body.includes("Roster") && r.body.includes("Signed"));
  r = await get("/admin/announcements", admin);
  check("announcements manager", r.body.includes("New announcement"), String(r.status));
  r = await get("/admin/settings", admin);
  check("settings page", r.body.includes("Leaderboard hides"), String(r.status));
  check("admins listed", r.body.includes("Riya the RA"));
  r = await get("/leaderboard", admin);
  check("admin sees leaderboard page", r.status === 200);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("CRASHED:", e); process.exit(1); });
