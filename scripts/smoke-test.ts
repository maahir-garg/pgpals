/**
 * Security & rules smoke test. Runs against the local stack AFTER `npm run seed`.
 * Exercises the database as real clients (anon / participant / admin) to prove
 * the server-side rules hold no matter what the UI does.
 *
 * Run: npx tsx scripts/smoke-test.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

try {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name} ${detail}`);
  }
}

function client(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

async function login(email: string): Promise<SupabaseClient> {
  const c = client();
  const { error } = await c.auth.signInWithPassword({
    email,
    password: "pgpals123",
  });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function main() {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const participant = await login("chloe.lim@u.nus.edu"); // Waffle Warriors
  const rival = await login("divya.pillai@u.nus.edu"); // Bubble Tea Bandits (team 10)
  const ra = await login("ra@pgpals.test");

  const { data: myProfile } = await participant.from("profiles").select("*").eq("email", "chloe.lim@u.nus.edu").single();
  const myTeam = myProfile!.team_id as string;

  console.log("\n— Task visibility —");
  {
    const { data: tasks } = await participant.from("tasks").select("title, is_published, release_at");
    const titles = (tasks ?? []).map((t) => t.title).join("|");
    check("participant sees released tasks", titles.includes("Dinner date"));
    check("participant cannot see scheduled task", !titles.includes("Weekend mystery"));
    check("participant cannot see draft task", !titles.includes("Karaoke"));
    const { data: adminTasks } = await ra.from("tasks").select("title");
    check("admin sees all tasks incl. draft", (adminTasks ?? []).some((t) => t.title.includes("Karaoke")));
  }

  console.log("\n— Submission isolation —");
  {
    const { data: mine } = await participant.from("submissions").select("team_id, pairing_id");
    const foreign = (mine ?? []).filter((s) => s.team_id !== myTeam && s.pairing_id === null);
    check("participant sees no other team's solo submissions", foreign.length === 0);
    const { data: all } = await admin.from("submissions").select("id", { count: "exact", head: false });
    const { data: raAll } = await ra.from("submissions").select("id");
    check("admin sees every submission", (raAll ?? []).length === (all ?? []).length);
  }

  console.log("\n— Submission rules (RPC) —");
  {
    const { data: closedTask } = await admin.from("tasks").select("id").ilike("title", "%penguin%").single();
    const { error } = await participant.rpc("create_submission", {
      p_task: closedTask!.id, p_text: "too late", p_photos: [`${myTeam}/x/1.jpg`], p_pairing: null,
    });
    check("submit after deadline rejected", !!error, error?.message ?? "");

    const { data: sweep } = await admin.from("tasks").select("id").ilike("title", "%sweep%").single();
    const { error: pathError } = await participant.rpc("create_submission", {
      p_task: sweep!.id, p_text: "sneaky", p_photos: ["someone-elses-team/x/1.jpg"], p_pairing: null,
    });
    check("photo path outside own team folder rejected", !!pathError);

    const { data: gratitude } = await admin.from("tasks").select("id").ilike("title", "%gratitude%").single();
    const { error: dupError } = await participant.rpc("create_submission", {
      p_task: gratitude!.id, p_text: "again", p_photos: [`${myTeam}/x/1.jpg`], p_pairing: null,
    });
    check("second pending submission blocked", !!dupError);

    // direct INSERT bypassing the RPC must be blocked by RLS
    const { error: insertError } = await participant.from("submissions").insert({
      task_id: sweep!.id, team_id: myTeam, text_content: "direct", photo_paths: [`${myTeam}/x/1.jpg`],
    });
    check("direct INSERT into submissions blocked", !!insertError);

    // valid submission works (rival team hasn't submitted to sweep)
    const { data: rivalProfile } = await admin.from("profiles").select("team_id").eq("email", "divya.pillai@u.nus.edu").single();
    const rivalTeam = rivalProfile!.team_id as string;
    const { data: path } = await rival.storage.from("submissions").upload(`${rivalTeam}/smoke/1.jpg`, Buffer.from([0xff, 0xd8, 0xff, 0xdb]), { contentType: "image/jpeg" });
    check("upload to own team folder works", !!path);
    const { data: subId, error: okError } = await rival.rpc("create_submission", {
      p_task: sweep!.id, p_text: "smoke test submission", p_photos: [`${rivalTeam}/smoke/1.jpg`], p_pairing: null,
    });
    check("valid submission accepted", !okError && !!subId, okError?.message ?? "");

    // review as participant must fail; as admin must work and compute bonus (+10 before cutoff)
    const { error: reviewAsUser } = await participant.rpc("review_submission", {
      p_submission: subId, p_approve: true, p_note: null, p_points_override: null,
    });
    check("participant cannot review", !!reviewAsUser);
    const { data: awarded, error: reviewError } = await ra.rpc("review_submission", {
      p_submission: subId, p_approve: true, p_note: null, p_points_override: null,
    });
    check("admin approve computes before-cutoff bonus (20+10=30)", awarded === 30, `got ${awarded} ${reviewError?.message ?? ""}`);
    await ra.rpc("revert_review", { p_submission: subId });
    const { error: rejectNoNote } = await ra.rpc("review_submission", {
      p_submission: subId, p_approve: false, p_note: "", p_points_override: null,
    });
    check("reject without reason blocked", !!rejectNoNote);
    // clean up: back to pending state for demo purposes
  }

  console.log("\n— Storage isolation —");
  {
    const { error } = await participant.storage.from("submissions").upload("not-my-team/hack/1.jpg", Buffer.from([1]), { contentType: "image/jpeg" });
    check("upload to another folder blocked", !!error);
    const { data: rivalProfile } = await admin.from("profiles").select("team_id").eq("email", "divya.pillai@u.nus.edu").single();
    const { data: files, error: listError } = await participant.storage.from("submissions").list(`${rivalProfile!.team_id}/smoke`);
    check("cannot list another team's photos", !!listError || (files ?? []).length === 0);
  }

  console.log("\n— Pairing rules —");
  {
    const { data: picnic } = await admin.from("tasks").select("id").ilike("title", "%picnic%").single();
    const { error: selfError } = await participant.rpc("create_pair_invite", { p_task: picnic!.id, p_partner: myTeam });
    check("cannot pair with own team", !!selfError);
    const { data: standard } = await admin.from("tasks").select("id").ilike("title", "%sweep%").single();
    const { error: typeError } = await participant.rpc("create_pair_invite", { p_task: standard!.id, p_partner: (await admin.from("teams").select("id").neq("id", myTeam).limit(1).single()).data!.id });
    check("cannot pair on a standard task", !!typeError);
  }

  console.log("\n— Leaderboard hiding —");
  {
    const { data: before } = await participant.rpc("get_leaderboard");
    check("leaderboard visible before hide date", (before ?? []).length > 0);
    // temporarily move hide date into the past
    await admin.from("event_settings").update({ leaderboard_hide_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", 1);
    const { data: after } = await participant.rpc("get_leaderboard");
    check("participant gets EMPTY leaderboard after hide date", (after ?? []).length === 0);
    const { data: adminBoard } = await ra.rpc("get_leaderboard");
    check("admin still sees leaderboard after hide date", (adminBoard ?? []).length > 0);
    const { data: ownScore } = await participant.rpc("get_my_score");
    check("own score still visible after hide", typeof ownScore === "number");
    const { error: directScore } = await participant.rpc("team_score", { p_team: myTeam });
    check("team_score() not directly callable", !!directScore);
    // restore
    await admin.from("event_settings").update({ leaderboard_hide_at: new Date(Date.now() + 6 * 86400_000).toISOString() }).eq("id", 1);
  }

  console.log("\n— Profile / team guards —");
  {
    const { data: promoted } = await participant.from("profiles").update({ role: "admin" }).eq("id", myProfile!.id).select();
    const { data: checkRole } = await participant.from("profiles").select("role").eq("id", myProfile!.id).single();
    check("participant cannot promote self", checkRole!.role === "participant", JSON.stringify(promoted));
    const { data: otherTeam } = await admin.from("teams").select("id, name").neq("id", myTeam).limit(1).single();
    const { data: renamed } = await participant.from("teams").update({ name: "HACKED" }).eq("id", otherTeam!.id).select();
    check("participant cannot rename another team", (renamed ?? []).length === 0);
    const { error: settingsError, data: settingsData } = await participant.from("event_settings").update({ leaderboard_hide_at: new Date(Date.now() + 999 * 86400_000).toISOString() }).eq("id", 1).select();
    check("participant cannot edit event settings", !!settingsError || (settingsData ?? []).length === 0);
  }

  console.log("\n— Signup gate —");
  {
    const anon = client();
    const { data: precheckBad } = await anon.rpc("signup_precheck", { p_email: "stranger@gmail.com" });
    check("precheck rejects unknown email", precheckBad?.ok === false);
    const { data: precheckGood } = await anon.rpc("signup_precheck", { p_email: "hafiz.bin.salleh@u.nus.edu" });
    check("precheck accepts rostered email", precheckGood?.ok === true && !!precheckGood?.team_name);
    const { error: strangerError } = await admin.auth.admin.createUser({
      email: "stranger@gmail.com",
      password: "password123",
      email_confirm: true,
    });
    check("signup with unknown email blocked by trigger", !!strangerError, strangerError?.message);
    const { data: signup, error: signupError } = await admin.auth.admin.createUser({
      email: "hafiz.bin.salleh@u.nus.edu",
      password: "pgpals123",
      email_confirm: true,
      user_metadata: { full_name: "Hafiz Bin Salleh" },
    });
    check("rostered signup works", !signupError && !!signup?.user, signupError?.message);
    if (signup?.user) {
      const { data: profile } = await admin.from("profiles").select("team_id, full_name").eq("id", signup.user.id).single();
      check("signup auto-linked to pre-assigned team", !!profile?.team_id);
      // reset so the demo "not signed up" state is preserved, and verify it:
      // a silent failure here leaves hafiz signed up and breaks the README's
      // "try the signup flow" demo.
      const { error: delError } = await admin.auth.admin.deleteUser(signup.user.id);
      const { data: leftover } = await admin.from("profiles").select("id").eq("id", signup.user.id);
      check("signup test user cleaned up", !delError && (leftover ?? []).length === 0, delError?.message);
    }
  }

  console.log("\n— Cleanup —");
  {
    // remove the test submission + photo so the demo review queue stays clean
    const { data: leftovers } = await admin
      .from("submissions")
      .select("id, photo_paths")
      .eq("text_content", "smoke test submission");
    for (const s of leftovers ?? []) {
      if (s.photo_paths?.length) await admin.storage.from("submissions").remove(s.photo_paths);
      await admin.from("submissions").delete().eq("id", s.id);
    }
    const { data: remaining } = await admin
      .from("submissions")
      .select("id")
      .eq("text_content", "smoke test submission");
    check("smoke submission cleaned up", (remaining ?? []).length === 0);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("SMOKE TEST CRASHED:", e);
  process.exit(1);
});
