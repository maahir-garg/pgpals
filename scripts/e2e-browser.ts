/**
 * Browser end-to-end pass with Playwright against http://localhost:3000
 * (needs `npm run dev` + seeded data). Logs in as a participant on a phone
 * viewport, submits a real photo through the form, then approves it as an
 * admin on desktop. Saves screenshots to the directory given as argv[2]
 * (default ./e2e-shots).
 *
 * Run: npx tsx scripts/e2e-browser.ts [outDir]
 */
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] ?? "./e2e-shots";
mkdirSync(OUT, { recursive: true });

let step = 0;
async function shot(page: Page, name: string) {
  step++;
  await page.screenshot({
    path: join(OUT, `${String(step).padStart(2, "0")}-${name}.png`),
    fullPage: false,
  });
  console.log(`  📸 ${name}`);
}

// a tiny valid jpeg for the upload (1x1 white pixel)
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64"
);

async function main() {
  const browser = await chromium.launch();

  console.log("Participant flow (iPhone 14 viewport)…");
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await phone.newPage();

  await page.goto(`${BASE}/login`);
  await shot(page, "login");
  await page.fill("#email", "chloe.lim@u.nus.edu");
  await page.fill("#password", "pgpals123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  await shot(page, "dashboard");

  await page.goto(`${BASE}/tasks`);
  await page.waitForLoadState("networkidle");
  await shot(page, "tasks-list");

  // open the Golden hour task (no submission yet for this team) and submit
  await page.click("text=Golden hour at the Mound");
  await page.waitForLoadState("networkidle");
  await shot(page, "task-detail");

  const photoPath = join(OUT, "upload.jpg");
  writeFileSync(photoPath, TINY_JPEG);
  await page.setInputFiles('input[type="file"]', photoPath);
  await page.waitForTimeout(1500); // compression
  await page.fill("textarea", "Golden hour was unreal today 🌇 (e2e test)");
  await shot(page, "task-filled");
  await page.click('button:has-text("Submit")');
  const submissionToast = page.locator("[data-sonner-toast]").last();
  await submissionToast.waitFor({ state: "visible", timeout: 20000 });
  const submissionMessage = (await submissionToast.textContent())?.trim() ?? "";
  if (!submissionMessage.includes("Submitted. Your RAs will review it soon!")) {
    throw new Error(`Participant submission failed: ${submissionMessage}`);
  }
  await page.reload();
  await page.waitForSelector("text=In review", { timeout: 20000 });
  await shot(page, "task-submitted");
  console.log("  ✅ photo submission went through the real form");

  await page.goto(`${BASE}/leaderboard`);
  await page.waitForLoadState("networkidle");
  await shot(page, "leaderboard");
  await phone.close();

  console.log("Admin flow (desktop viewport)…");
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admin = await desktop.newPage();
  await admin.goto(`${BASE}/login`);
  await admin.fill("#email", "ra@pgpals.test");
  await admin.fill("#password", "pgpals123");
  await admin.click("button[type=submit]");
  await admin.waitForURL("**/dashboard", { timeout: 20000 });
  await admin.goto(`${BASE}/admin`);
  await admin.waitForLoadState("networkidle");
  await shot(admin, "admin-overview");

  await admin.goto(`${BASE}/admin/review`);
  await admin.waitForLoadState("networkidle");
  await shot(admin, "admin-review");

  // approve the submission we just made
  const reviewCard = admin.locator('[data-slot="card"]').filter({
    hasText: "Golden hour was unreal today",
  });
  await reviewCard.getByRole("button", { name: "Approve" }).click();
  await admin.waitForSelector("text=Approved for", { timeout: 20000 });
  console.log("  ✅ approved via the review UI");

  await admin.goto(`${BASE}/admin/tasks`);
  await admin.waitForLoadState("networkidle");
  await shot(admin, "admin-tasks");
  await admin.goto(`${BASE}/admin/teams`);
  await admin.waitForLoadState("networkidle");
  await shot(admin, "admin-teams");
  await admin.goto(`${BASE}/admin/settings`);
  await admin.waitForLoadState("networkidle");
  await shot(admin, "admin-settings");
  await desktop.close();

  // participant sees the approval
  console.log("Verifying participant sees the approval…");
  const phone2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page2 = await phone2.newPage();
  await page2.goto(`${BASE}/login`);
  await page2.fill("#email", "chloe.lim@u.nus.edu");
  await page2.fill("#password", "pgpals123");
  await page2.click("button[type=submit]");
  await page2.waitForURL("**/dashboard", { timeout: 20000 });
  await page2.goto(`${BASE}/tasks`);
  await page2.click("text=Golden hour at the Mound");
  await page2.waitForSelector("text=PGP Coins earned", { timeout: 20000 });
  await shot(page2, "participant-sees-approval");
  console.log("  ✅ approval + PGP Coins visible to the team");
  await phone2.close();

  await browser.close();
  console.log(`\nDone. Screenshots in ${OUT}`);
}

main().catch((e) => {
  console.error("E2E FAILED:", e);
  process.exit(1);
});
