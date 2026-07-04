import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Signed URLs for submission photos, valid 1 hour. Callers must have already
// proven access by reading the submission row through an RLS-checked query;
// photo paths are only reachable via readable submissions.
export async function getSignedPhotoUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("submissions")
    .createSignedUrls(paths, 3600);
  if (error || !data) return [];
  return data.map((d) => d.signedUrl ?? "");
}

export async function getSignedPhotoUrlMap(
  paths: string[]
): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths)].filter(Boolean);
  if (uniquePaths.length === 0) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("submissions")
    .createSignedUrls(uniquePaths, 3600);
  if (error || !data) return new Map();

  return new Map(
    data.map((item, index) => [uniquePaths[index], item.signedUrl ?? ""])
  );
}
