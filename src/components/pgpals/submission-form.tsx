"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Send, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";
import { submitTask } from "@/app/(app)/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const MAX_PHOTOS = 5;

type Preview = { file: File; url: string };

// Photo + caption submission form. Photos are compressed in the browser
// (~200 KB, max 1280px) before upload so 400 users fit in free-tier storage.
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
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_PHOTOS - previews.length;
    const files = Array.from(list).slice(0, room);
    if (files.length === 0) {
      toast.error(`Max ${MAX_PHOTOS} photos.`);
      return;
    }
    setCompressing(true);
    try {
      const compressed = await Promise.all(
        files.map((f) =>
          imageCompression(f, {
            maxSizeMB: 0.2,
            maxWidthOrHeight: 1280,
            useWebWorker: true,
            fileType: "image/jpeg",
            initialQuality: 0.8,
          })
        )
      );
      setPreviews((prev) => [
        ...prev,
        ...compressed.map((file) => ({
          file,
          url: URL.createObjectURL(file),
        })),
      ]);
    } catch {
      toast.error("Couldn't process one of the photos. Try a different one.");
    } finally {
      setCompressing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function removePhoto(index: number) {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function submit() {
    if (previews.length === 0) {
      toast.error("Add at least one photo.");
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
        for (let i = 0; i < previews.length; i++) {
          const path = `${teamId}/${folder}/${i + 1}.jpg`;
          const { error } = await supabase.storage
            .from("submissions")
            .upload(path, previews[i].file, { contentType: "image/jpeg" });
          if (error) throw new Error("Photo upload failed. Check your connection and try again.");
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
            Add clear photos first. A short note is optional.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {previews.map((p, i) => (
            <div key={p.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={`Photo ${i + 1}`}
                className="size-20 rounded-md object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-foreground text-background shadow-sm"
                aria-label={`Remove photo ${i + 1}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
          {previews.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={compressing}
              className="grid size-20 place-items-center rounded-md border border-dashed border-muted-foreground/40 bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              aria-label="Add photos"
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
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
        <p className="text-xs text-muted-foreground">
          1–5 photos · compressed on your phone before upload
        </p>

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
          {pending ? "Uploading..." : resubmit ? "Resubmit" : "Submit"}
        </Button>
      </CardContent>
    </Card>
  );
}
