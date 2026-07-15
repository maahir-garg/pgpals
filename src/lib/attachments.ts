import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SignedAttachment = {
  path: string;
  url: string;
  kind: "image" | "video";
};

const VIDEO_EXTENSION = /\.(mp4|mov|webm)$/i;

export function attachmentKind(path: string): "image" | "video" {
  return VIDEO_EXTENSION.test(path) ? "video" : "image";
}

// Signed URLs for private submission media, valid for one hour. Callers must
// first prove access by reading the submission row through an RLS-checked query.
export async function getSignedAttachmentUrlMap(
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

export function signedAttachments(
  paths: string[],
  urlByPath: Map<string, string>
): SignedAttachment[] {
  return paths.map((path) => ({
    path,
    url: urlByPath.get(path) ?? "",
    kind: attachmentKind(path),
  }));
}
