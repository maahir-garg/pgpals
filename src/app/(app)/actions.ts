"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

type UploadFileInput = { contentType: string; size: number };
type UploadReservationResult =
  | {
      ok: true;
      batchId: string;
      uploads: { path: string; token: string }[];
    }
  | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  const message =
    error instanceof Error ? error.message : "Something went wrong.";
  // Postgres RAISE EXCEPTION messages come through as-is; they are written
  // to be participant-friendly.
  return { ok: false, error: message.replace(/^.*?: /, "") };
}

async function cancelUploadBatchWithAdmin(
  admin: ReturnType<typeof createAdminClient>,
  batchId: string,
  createdBy?: string
) {
  let claim = admin
    .from("submission_upload_batches")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", batchId)
    .is("consumed_at", null)
    .is("cancelled_at", null);
  if (createdBy) claim = claim.eq("created_by", createdBy);

  const { data: batch, error: claimError } = await claim
    .select("paths")
    .maybeSingle<{ paths: string[] }>();
  if (claimError) throw new Error(claimError.message);
  if (!batch) return false;

  const { error: removeError } = await admin.storage
    .from("submissions")
    .remove(batch.paths);
  if (removeError) {
    await admin
      .from("submission_upload_batches")
      .update({ cancelled_at: null })
      .eq("id", batchId)
      .is("consumed_at", null);
    throw new Error("Could not clean up the reserved uploads. Try again.");
  }
  return true;
}

async function cleanupExpiredUploadBatches(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string
) {
  const { data: expired, error } = await admin
    .from("submission_upload_batches")
    .select("id")
    .eq("team_id", teamId)
    .is("consumed_at", null)
    .is("cancelled_at", null)
    .lte("expires_at", new Date().toISOString());
  if (error) throw new Error(error.message);

  for (const batch of expired ?? []) {
    await cancelUploadBatchWithAdmin(admin, batch.id);
  }
}

export async function reserveSubmissionUploads(input: {
  taskId: string;
  pairingId: string | null;
  files: UploadFileInput[];
}): Promise<UploadReservationResult> {
  if (input.files.length < 1 || input.files.length > 5) {
    return { ok: false, error: "Choose 1 to 5 supported attachments." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Log in again before uploading." };

  const { data: profile } = await supabase
    .rpc("get_my_profile")
    .single<{ team_id: string | null }>();
  if (!profile?.team_id) {
    return { ok: false, error: "You are not on a team." };
  }

  const admin = createAdminClient();
  try {
    await cleanupExpiredUploadBatches(admin, profile.team_id);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not prepare uploads.",
    };
  }

  const { data: batch, error: reserveError } = await supabase
    .rpc("reserve_submission_uploads", {
      p_task: input.taskId,
      p_pairing: input.pairingId,
      p_files: input.files.map((file) => ({
        content_type: file.contentType,
        size: file.size,
      })),
    })
    .single<{ batch_id: string; paths: string[] }>();
  if (reserveError || !batch) {
    return {
      ok: false,
      error: reserveError?.message ?? "Could not reserve uploads.",
    };
  }

  try {
    const uploads = await Promise.all(
      batch.paths.map(async (path) => {
        const { data, error } = await admin.storage
          .from("submissions")
          .createSignedUploadUrl(path);
        if (error || !data?.token) {
          throw new Error(error?.message ?? "Could not authorize an upload.");
        }
        return { path, token: data.token };
      })
    );
    return { ok: true, batchId: batch.batch_id, uploads };
  } catch (error) {
    await cancelUploadBatchWithAdmin(admin, batch.batch_id).catch(() => {});
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not authorize uploads.",
    };
  }
}

export async function cancelSubmissionUploadBatch(
  batchId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Log in again before cleaning up." };

  try {
    await cancelUploadBatchWithAdmin(createAdminClient(), batchId, user.id);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
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
