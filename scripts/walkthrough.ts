/**
 * Screenshot walkthrough of every page at phone and desktop sizes, used for
 * design dry runs (needs `npm run dev` + seeded data).
 *
 * Run: npx tsx scripts/walkthrough.ts [outDir]
 */
import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] ?? "./walkthrough-shots";
mkdirSync(OUT, { recursive: true });

async function shot(page: Page, name: string, fullPage = false) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
  console.log(`  ${name}`);
}

// Fresh context per login: contexts share cookies, and a logged-in visitor
// gets bounced from /login to /dashboard by the middleware.
async function login(ctx: BrowserContext, email: string) {
  await ctx.clearCookies();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", "pgpals123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  return page;
}

async function main() {
  const browser = await chromium.launch();
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  console.log("public pages");
  for (const [ctx, tag] of [[phone, "phone"], [desktop, "desktop"]] as const) {
    const p = await ctx.newPage();
    await p.goto(BASE);
    await shot(p, `landing-${tag}`, true);
    await p.goto(`${BASE}/login`);
    await shot(p, `login-${tag}`);
    await p.goto(`${BASE}/signup`);
    await shot(p, `signup-${tag}`);
    await p.close();
  }

  console.log("participant");
  for (const [ctx, tag] of [[phone, "phone"], [desktop, "desktop"]] as const) {
    const p = await login(ctx, "chloe.lim@u.nus.edu");
    await shot(p, `dashboard-${tag}`, true);
    await p.goto(`${BASE}/tasks`);
    await shot(p, `tasks-${tag}`, true);
    // a task with a submission form
    await p.click("text=Golden hour at the Mound");
    await shot(p, `task-open-${tag}`, true);
    await p.goto(`${BASE}/tasks`);
    await p.click("text=movie night");
    await shot(p, `task-pair-${tag}`, true);
    await p.goto(`${BASE}/leaderboard`);
    await shot(p, `leaderboard-${tag}`, true);
    await p.close();
  }

  console.log("participant with rejection (phone)");
  {
    const p = await login(phone, "shreya.iyer@u.nus.edu");
    await shot(p, "dashboard-rejected-phone", true);
    await p.close();
  }

  console.log("admin (desktop)");
  {
    const p = await login(desktop, "ra@pgpals.test");
    await p.goto(`${BASE}/admin`);
    await shot(p, "admin-overview", true);
    await p.goto(`${BASE}/admin/review`);
    await shot(p, "admin-review", true);
    await p.goto(`${BASE}/admin/tasks`);
    await shot(p, "admin-tasks", true);
    await p.goto(`${BASE}/admin/tasks/new`);
    await shot(p, "admin-task-new", true);
    await p.goto(`${BASE}/admin/teams`);
    await shot(p, "admin-teams", true);
    await p.goto(`${BASE}/admin/announcements`);
    await shot(p, "admin-announcements", true);
    await p.goto(`${BASE}/admin/settings`);
    await shot(p, "admin-settings", true);
    await p.close();
  }

  await browser.close();
  console.log(`Done. Screenshots in ${OUT}`);
}

main().catch((e) => {
  console.error("WALKTHROUGH FAILED:", e);
  process.exit(1);
});
