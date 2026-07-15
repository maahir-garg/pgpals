"use client";

import { useRef, useState, useTransition } from "react";
import { FileVideo, ImagePlus, Send, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import * as tus from "tus-js-client";
import { toast } from "sonner";
import { submitTask } from "@/app/(app)/actions";
import { createClient } from "@/lib/supabase/client";
import { supabaseUrl } from "@/lib/supabase/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const MAX_ATTACHMENTS = 5;
const MAX_VIDEOS = 3;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 60;
const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

type Preview = {
  file: File;
  url: string;
  kind: "image" | "video";
  contentType: string;
  extension: "jpg" | "mp4" | "mov" | "webm";
};

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Couldn't read a video's duration. Try MP4, MOV, or WebM."));
    };
    video.src = url;
  });
}

function resumableUploadEndpoint(): string {
  if (!supabaseUrl) throw new Error("Storage is not configured.");
  const url = new URL(supabaseUrl);
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
    return `${url.origin}/storage/v1/upload/resumable`;
  }
  const projectId = url.hostname.split(".")[0];
  return `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;
}

function uploadVideoResumable(
  file: File,
  path: string,
  contentType: string,
  accessToken: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: resumableUploadEndpoint(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${accessToken}` },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: "submissions",
        objectName: path,
        contentType,
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      onError: (error) => reject(error),
      onProgress: (uploaded, total) =>
        onProgress(Math.round((uploaded / total) * 100)),
      onSuccess: () => resolve(),
    });

    void upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    }, reject);
  });
}

// Mixed-media proof form. Images are compressed in the browser (~300 KB,
// max 1600px); videos use resumable TUS uploads for unreliable mobile links.
export function SubmissionForm({
  taskId,
  teamId,
  pairingId,
  resubmit,
}: {
  taskId: string;
  teamId: string;
  pairingId: string | null;
  resubmit: boolean;
}) {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [text, setText] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_ATTACHMENTS - previews.length;
    const files = Array.from(list).slice(0, room);
    if (files.length === 0) {
      toast.error(`Max ${MAX_ATTACHMENTS} attachments.`);
      return;
    }
    if (files.some((file) => !file.type.startsWith("image/") && !VIDEO_TYPES.has(file.type))) {
      toast.error("Use photos, MP4, MOV, or WebM videos only.");
      return;
    }
    const existingVideoPreviews = previews.filter(
      (preview) => preview.kind === "video"
    );
    const existingVideos = existingVideoPreviews.length;
    const newVideos = files.filter((file) => VIDEO_TYPES.has(file.type));
    if (existingVideos + newVideos.length > MAX_VIDEOS) {
      toast.error(`Add at most ${MAX_VIDEOS} videos per submission.`);
      return;
    }
    if (newVideos.some((file) => file.size > MAX_VIDEO_BYTES)) {
      toast.error("Each video must be 50 MB or smaller. Trim or compress the clip first.");
      return;
    }
    const totalVideoBytes = [...existingVideoPreviews.map((p) => p.file), ...newVideos]
      .reduce((total, file) => total + file.size, 0);
    if (totalVideoBytes > MAX_TOTAL_VIDEO_BYTES) {
      toast.error("Videos can total at most 100 MB per submission.");
      return;
    }
    if (
      files.some(
        (file) => file.type.startsWith("image/") && file.size > MAX_SOURCE_IMAGE_BYTES
      )
    ) {
      toast.error("Each original photo must be 15 MB or smaller.");
      return;
    }
    setCompressing(true);
    try {
      const processed = await Promise.all(
        files.map(async (file): Promise<Preview> => {
          if (VIDEO_TYPES.has(file.type)) {
            const duration = await getVideoDuration(file);
            if (!Number.isFinite(duration) || duration > MAX_VIDEO_SECONDS) {
              throw new Error("Videos must be 60 seconds or shorter.");
            }
            const extension =
              file.type === "video/quicktime"
                ? "mov"
                : file.type === "video/webm"
                  ? "webm"
                  : "mp4";
            return {
              file,
              url: URL.createObjectURL(file),
              kind: "video",
              contentType: file.type,
              extension,
            };
          }
          const compressed = await imageCompression(file, {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
            fileType: "image/jpeg",
            initialQuality: 0.8,
          });
          return {
            file: compressed,
            url: URL.createObjectURL(compressed),
            kind: "image",
            contentType: "image/jpeg",
            extension: "jpg",
          };
        })
      );
      setPreviews((prev) => [...prev, ...processed]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't process one of the attachments. Try a different file."
      );
    } finally {
      setCompressing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function removeAttachment(index: number) {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function submit() {
    if (previews.length === 0) {
      toast.error("Add at least one photo or video.");
      return;
    }
    startTransition(async () => {
      const uploadedPaths: string[] = [];
      const supabase = createClient();
      async function cleanupUploads() {
        if (uploadedPaths.length === 0) return;
        await supabase.storage.from("submissions").remove(uploadedPaths);
      }

      try {
        const folder = crypto.randomUUID();
        const paths: string[] = [];
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Your session expired. Log in and try again.");
        for (let i = 0; i < previews.length; i++) {
          const preview = previews[i];
          const path = `${teamId}/${folder}/${i + 1}.${preview.extension}`;
          if (preview.kind === "video") {
            await uploadVideoResumable(
              preview.file,
              path,
              preview.contentType,
              session.access_token,
              (percent) => setUploadStatus(`Uploading video: ${percent}%`)
            );
          } else {
            const { error } = await supabase.storage
              .from("submissions")
              .upload(path, preview.file, { contentType: preview.contentType });
            if (error)
              throw new Error("Upload failed. Check your connection and try again.");
          }
          paths.push(path);
          uploadedPaths.push(path);
        }
        const result = await submitTask({
          taskId,
          text,
          photoPaths: paths,
          pairingId,
        });
        if (!result.ok) {
          await cleanupUploads().catch(() => {});
          toast.error(result.error);
          return;
        }
        toast.success("Submitted. Your RAs will review it soon!");
        previews.forEach((p) => URL.revokeObjectURL(p.url));
        setPreviews([]);
        setText("");
      } catch (e) {
        await cleanupUploads().catch(() => {});
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setUploadStatus(null);
      }
    });
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-base font-bold">
            {resubmit ? "Fix and resubmit" : "Submit proof"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add clear photo or video proof. A short note is optional.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {previews.map((p, i) => (
            <div key={p.url} className="relative">
              {p.kind === "video" ? (
                <div className="relative size-20 overflow-hidden rounded-md bg-foreground">
                  <video
                    src={p.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="size-full object-cover opacity-80"
                  />
                  <FileVideo className="absolute inset-0 m-auto size-6 text-background" aria-hidden />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.url}
                  alt={`Photo ${i + 1}`}
                  className="size-20 rounded-md object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-foreground text-background shadow-sm"
                aria-label={`Remove attachment ${i + 1}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
          {previews.length < MAX_ATTACHMENTS && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={compressing}
              className="grid size-20 place-items-center rounded-md border border-dashed border-muted-foreground/40 bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              aria-label="Add photos or videos"
            >
              {compressing ? (
                <span className="text-sm font-semibold">...</span>
              ) : (
                <ImagePlus className="size-6" aria-hidden />
              )}
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/mp4,video/quicktime,video/webm"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            1–5 attachments · max 3 videos (MP4, MOV, or WebM)
          </p>
          <p>
            Each video: max 60 sec / 50 MB · videos combined: max 100 MB
          </p>
          <p>
            Photos: max 15 MB each, compressed before upload · videos upload
            resumably and unchanged
          </p>
          <p className="font-semibold text-foreground">
            AI-generated media is not allowed. Every upload is screened by
            our AI checker and may be rejected.
          </p>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell us about it! (optional)"
          rows={3}
          className="bg-card"
        />

        <Button
          onClick={submit}
          disabled={pending || compressing || previews.length === 0}
          className="w-full font-bold"
        >
          <Send className="size-4" aria-hidden />
          {uploadStatus ?? (pending ? "Uploading..." : resubmit ? "Resubmit" : "Submit")}
        </Button>
      </CardContent>
    </Card>
  );
}
