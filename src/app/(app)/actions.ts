"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  const message =
    error instanceof Error ? error.message : "Something went wrong.";
  // Postgres RAISE EXCEPTION messages come through as-is; they are written
  // to be participant-friendly.
  return { ok: false, error: message.replace(/^.*?: /, "") };
}

export async function submitTask(input: {
  taskId: string;
  text: string;
  photoPaths: string[];
  pairingId: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_submission", {
    p_task: input.taskId,
    p_text: input.text,
    p_photos: input.photoPaths,
    p_pairing: input.pairingId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/tasks/${input.taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function invitePartners(
  taskId: string,
  partnerTeamIds: string[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_pair_invite", {
    p_task: taskId,
    p_partners: partnerTeamIds,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function respondInvite(
  taskId: string,
  pairingId: string,
  accept: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_pair_invite", {
    p_pairing: pairingId,
    p_accept: accept,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function cancelInvite(
  taskId: string,
  pairingId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_pair_invite", {
    p_pairing: pairingId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function renameTeam(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40) {
    return { ok: false, error: "Team name must be 2–40 characters." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", user.id)
    .single();
  if (!profile?.team_id) return { ok: false, error: "You are not on a team." };

  const { error } = await supabase
    .from("teams")
    .update({ name: trimmed })
    .eq("id", profile.team_id);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That team name is taken, try another!" };
    }
    return fail(error);
  }
  revalidatePath("/dashboard");
  return { ok: true };
}
