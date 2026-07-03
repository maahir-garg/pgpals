"use client";

import { useState, useTransition } from "react";
import { Check, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { reviewSubmission, revertReview } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/pgpals/badges";
import type { Submission, SubmissionStatus } from "@/lib/types";

export function ReviewCard({
  submission,
  photoUrls,
  taskTitle,
  basePoints,
  bonusNote,
  preview,
  teamLabel,
  submittedAt,
  reviewedAt,
  status,
}: {
  submission: Submission;
  photoUrls: string[];
  taskTitle: string;
  basePoints: number;
  bonusNote: string | null;
  preview: number;
  teamLabel: string;
  submittedAt: string;
  reviewedAt: string | null;
  status: SubmissionStatus;
}) {
  const [points, setPoints] = useState(String(preview));
  const [note, setNote] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(approve: boolean) {
    if (!approve && !note.trim()) {
      toast.error("A rejection reason is required. The team will see it.");
      return;
    }
    const override = Number(points);
    if (approve && (!Number.isInteger(override) || override < 0)) {
      toast.error("Coins must be a whole number ≥ 0.");
      return;
    }
    startTransition(async () => {
      const result = await reviewSubmission({
        submissionId: submission.id,
        approve,
        note: note.trim(),
        pointsOverride: approve && override !== preview ? override : null,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  function revert() {
    startTransition(async () => {
      const result = await revertReview(submission.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold leading-snug">{taskTitle}</h3>
            <p className="text-sm font-semibold text-primary">{teamLabel}</p>
            <p className="text-xs text-muted-foreground">
              Submitted {submittedAt}
              {reviewedAt ? ` · reviewed ${reviewedAt}` : ""}
            </p>
          </div>
          <StatusBadge status={submission.status} />
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {photoUrls.map((url, i) =>
            url ? (
              <button key={i} type="button" onClick={() => setLightbox(url)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="h-28 w-28 shrink-0 rounded-md object-cover transition-transform hover:scale-105"
                />
              </button>
            ) : null
          )}
        </div>

        {submission.text_content && (
          <p className="rounded-md bg-muted p-3 text-sm">
            &quot;{submission.text_content}&quot;
          </p>
        )}

        {status === "pending" ? (
          <>
            {bonusNote && (
              <p className="text-xs font-semibold text-muted-foreground">
                {bonusNote}
              </p>
            )}
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold" htmlFor={`pts-${submission.id}`}>
                Coins
              </label>
              <Input
                id={`pts-${submission.id}`}
                type="number"
                min={0}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="h-9 w-24"
              />
              <span className="text-xs text-muted-foreground">
                auto: {preview} (base {basePoints})
              </span>
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note to the team (required if rejecting)"
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => decide(true)}
                disabled={pending}
                className="flex-1 font-bold"
              >
                <Check className="size-4" aria-hidden /> Approve
              </Button>
              <Button
                onClick={() => decide(false)}
                disabled={pending}
                variant="outline"
                className="flex-1 font-bold text-destructive hover:text-destructive"
              >
                <X className="size-4" aria-hidden /> Reject
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm">
              {submission.status === "approved" && (
                <span className="font-bold text-primary">
                  +{submission.points_awarded} coins
                </span>
              )}
              {submission.review_note && (
                <span className="text-muted-foreground">
                  {" "}
                  · &quot;{submission.review_note}&quot;
                </span>
              )}
            </div>
            {(submission.status === "approved" ||
              submission.status === "rejected") && (
              <Button
                onClick={revert}
                disabled={pending}
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                <Undo2 className="size-4" aria-hidden /> Undo review
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={!!lightbox} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {lightbox && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox} alt="Submission photo" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
