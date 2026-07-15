"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { sgtInputToUtc } from "@/lib/datetime";
import type { BonusConfig } from "@/lib/types";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

// Every action runs with the admin's own session, so RLS + the admin-only
// RPCs are the real enforcement; these functions are just plumbing.

async function adminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in.");
  return supabase;
}

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------- review ---

export async function reviewSubmission(input: {
  submissionId: string;
  approve: boolean;
  note: string;
  pointsOverride: number | null;
}): Promise<ActionResult> {
  const supabase = await adminClient();
  const { data, error } = await supabase.rpc("review_submission", {
    p_submission: input.submissionId,
    p_approve: input.approve,
    p_note: input.note || null,
    p_points_override: input.pointsOverride,
  });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: input.approve ? `Approved for ${data} PGP Coins.` : "Rejected.",
  };
}

export async function revertReview(submissionId: string): Promise<ActionResult> {
  const supabase = await adminClient();
  const { error } = await supabase.rpc("revert_review", {
    p_submission: submissionId,
  });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  return { ok: true, message: "Back to pending." };
}

// ----------------------------------------------------------------- tasks ---

export interface TaskInput {
  title: string;
  description: string;
  points: number;
  type: "standard" | "pair";
  pairTeamCount: number;
  releaseAtSgt: string; // from <input type="datetime-local">, SGT
  deadlineAtSgt: string;
  isPublished: boolean;
  bonusConfig: BonusConfig | null;
}

function taskRow(input: TaskInput) {
  return {
    title: input.title.trim(),
    description: input.description,
    points: input.points,
    type: input.type,
    pair_team_count: input.pairTeamCount,
    release_at: sgtInputToUtc(input.releaseAtSgt),
    deadline_at: sgtInputToUtc(input.deadlineAtSgt),
    is_published: input.isPublished,
    bonus_config: input.bonusConfig,
  };
}

export async function createTask(input: TaskInput): Promise<ActionResult> {
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  const supabase = await adminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("tasks")
    .insert({ ...taskRow(input), created_by: user!.id });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  revalidatePath("/tasks");
  return { ok: true, message: "Task created." };
}

export async function updateTask(
  taskId: string,
  input: TaskInput
): Promise<ActionResult> {
  const supabase = await adminClient();
  const { error } = await supabase
    .from("tasks")
    .update(taskRow(input))
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, message: "Task updated." };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const supabase = await adminClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  revalidatePath("/tasks");
  return { ok: true, message: "Task deleted." };
}

// ----------------------------------------------------------------- teams ---

// CSV columns: team_name, member1_name, member1_email, member2_name, member2_email
export async function importTeamsCsv(formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a CSV file." };
  const text = await file.text();

  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    return { ok: false, error: `CSV parse error: ${parsed.errors[0].message}` };
  }

  let rows = parsed.data;
  // Tolerate a header row.
  if (rows[0]?.[0]?.toLowerCase().replace(/[^a-z]/g, "") === "teamname") {
    rows = rows.slice(1);
  }

  const supabase = await adminClient();
  let created = 0;
  const problems: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const [teamName, name1, email1, name2, email2] = rows[i].map((c) =>
      (c ?? "").trim()
    );
    const line = i + 1;
    if (!teamName || !name1 || !email1 || !name2 || !email2) {
      problems.push(`Line ${line}: expected 5 columns (team, name1, email1, name2, email2).`);
      continue;
    }
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({ name: teamName })
      .select("id")
      .single();
    if (teamError) {
      problems.push(
        teamError.code === "23505"
          ? `Line ${line}: team "${teamName}" already exists, skipped.`
          : `Line ${line}: ${teamError.message}`
      );
      continue;
    }
    const { error: rosterError } = await supabase.from("roster").insert([
      { email: email1.toLowerCase(), full_name: name1, team_id: team.id },
      { email: email2.toLowerCase(), full_name: name2, team_id: team.id },
    ]);
    if (rosterError) {
      // Roll back the team so the row can be fixed and re-imported cleanly.
      await supabase.from("teams").delete().eq("id", team.id);
      problems.push(
        rosterError.code === "23505"
          ? `Line ${line}: an email is already on another team, skipped "${teamName}".`
          : `Line ${line}: ${rosterError.message}`
      );
      continue;
    }
    created++;
  }

  revalidateAdmin();
  const summary = `Imported ${created} team${created === 1 ? "" : "s"}.`;
  if (problems.length > 0) {
    const detail = `${summary}\n${problems.join("\n")}`;
    return created > 0 ? { ok: true, message: detail } : { ok: false, error: detail };
  }
  return { ok: true, message: summary };
}

export async function createTeam(name: string): Promise<ActionResult> {
  if (!name.trim()) return { ok: false, error: "Team name required." };
  const supabase = await adminClient();
  const { error } = await supabase.from("teams").insert({ name: name.trim() });
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Team name already exists." : error.message,
    };
  }
  revalidateAdmin();
  return { ok: true, message: "Team created." };
}

export async function deleteTeam(teamId: string): Promise<ActionResult> {
  const supabase = await adminClient();
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  return { ok: true, message: "Team deleted." };
}

export async function renameTeamAdmin(
  teamId: string,
  name: string
): Promise<ActionResult> {
  const supabase = await adminClient();
  const { error } = await supabase
    .from("teams")
    .update({ name: name.trim() })
    .eq("id", teamId);
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  return { ok: true, message: "Team renamed." };
}

export async function addRosterMember(input: {
  teamId: string;
  fullName: string;
  email: string;
}): Promise<ActionResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.fullName.trim()) {
    return { ok: false, error: "Name and email required." };
  }
  const supabase = await adminClient();
  const { error } = await supabase.from("roster").insert({
    team_id: input.teamId,
    full_name: input.fullName.trim(),
    email,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "That email is already on a team's roster."
          : error.message,
    };
  }
  // If a legacy/teamless profile already exists, link it now.
  await supabase
    .from("profiles")
    .update({ team_id: input.teamId })
    .eq("email", email);
  revalidateAdmin();
  return { ok: true, message: "Member added." };
}

// Regrouping (e.g. two residents who aren't getting along): the RPC moves the
// roster entry and any signed-up profile together in one transaction.
export async function moveRosterMember(input: {
  rosterId: string;
  toTeamId: string;
}): Promise<ActionResult> {
  if (!input.toTeamId) return { ok: false, error: "Pick a destination team." };
  const supabase = await adminClient();
  const { error } = await supabase.rpc("move_roster_member", {
    p_roster: input.rosterId,
    p_team: input.toTeamId,
  });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  revalidatePath("/", "layout");
  return { ok: true, message: "Member moved." };
}

export async function removeRosterMember(rosterId: string): Promise<ActionResult> {
  const supabase = await adminClient();
  const { data: entry } = await supabase
    .from("roster")
    .select("email")
    .eq("id", rosterId)
    .single();
  const { error } = await supabase.from("roster").delete().eq("id", rosterId);
  if (error) return { ok: false, error: error.message };
  if (entry) {
    await supabase
      .from("profiles")
      .update({ team_id: null })
      .eq("email", entry.email);
  }
  revalidateAdmin();
  return { ok: true, message: "Member removed." };
}

export async function grantBonus(input: {
  teamId: string;
  points: number;
  reason: string;
}): Promise<ActionResult> {
  if (!input.reason.trim()) return { ok: false, error: "A reason is required." };
  if (!Number.isInteger(input.points) || input.points === 0) {
    return { ok: false, error: "Points must be a non-zero whole number." };
  }
  const supabase = await adminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("bonus_awards").insert({
    team_id: input.teamId,
    points: input.points,
    reason: input.reason.trim(),
    awarded_by: user!.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  revalidatePath("/", "layout");
  return { ok: true, message: "Bonus granted." };
}

// -------------------------------------------------------- announcements ---

export async function saveAnnouncement(input: {
  id: string | null;
  title: string;
  body: string;
  pinned: boolean;
}): Promise<ActionResult> {
  if (!input.title.trim()) return { ok: false, error: "Title required." };
  const supabase = await adminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const row = { title: input.title.trim(), body: input.body, pinned: input.pinned };
  const { error } = input.id
    ? await supabase.from("announcements").update(row).eq("id", input.id)
    : await supabase
        .from("announcements")
        .insert({ ...row, created_by: user!.id });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  revalidatePath("/dashboard");
  return { ok: true, message: input.id ? "Updated." : "Posted." };
}

export async function togglePin(id: string, pinned: boolean): Promise<ActionResult> {
  const supabase = await adminClient();
  const { error } = await supabase
    .from("announcements")
    .update({ pinned })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  revalidatePath("/dashboard");
  return { ok: true, message: "Deleted." };
}

// -------------------------------------------------------------- settings ---

export async function updateSettings(input: {
  eventName: string;
  startAtSgt: string;
  endAtSgt: string;
  leaderboardHideAtSgt: string;
}): Promise<ActionResult> {
  const supabase = await adminClient();
  const { error } = await supabase
    .from("event_settings")
    .update({
      event_name: input.eventName.trim() || "PGPals: The Emerald Challenge",
      start_at: sgtInputToUtc(input.startAtSgt),
      end_at: sgtInputToUtc(input.endAtSgt),
      leaderboard_hide_at: sgtInputToUtc(input.leaderboardHideAtSgt),
    })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

// The allowlist is the single admin path: an email added here becomes an
// admin at signup (handle_new_user). Adding an email that already has an
// account promotes it immediately, so RAs never wait on a second step.
export async function addAdminEmail(email: string): Promise<ActionResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return { ok: false, error: "Enter a valid email." };
  const supabase = await adminClient();
  const { error } = await supabase
    .from("admin_allowlist")
    .insert({ email: normalized });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "That email is already on the list."
          : error.message,
    };
  }
  const { data: promoted } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("email", normalized)
    .select("id");
  revalidateAdmin();
  return {
    ok: true,
    message:
      promoted && promoted.length > 0
        ? "Added, and their existing account is now an admin."
        : "Added. They become an admin when they sign up.",
  };
}

export async function demoteAdminEmail(email: string): Promise<ActionResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return { ok: false, error: "Enter a valid email." };
  const supabase = await adminClient();
  const { data, error } = await supabase.rpc("demote_admin", {
    p_email: normalized,
  });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  revalidatePath("/", "layout");
  const result = data as {
    demoted?: boolean;
    allowlist_removed?: boolean;
  } | null;
  return {
    ok: true,
    message: result?.demoted
      ? "Admin access removed and all sessions revoked."
      : "Removed from the future-admin list.",
  };
}
