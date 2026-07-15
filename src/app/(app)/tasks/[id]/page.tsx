import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/data";
import { isClosed } from "@/lib/status";
import { formatSGT } from "@/lib/datetime";
import { describeBonus } from "@/lib/bonus";
import {
  getSignedAttachmentUrlMap,
  signedAttachments,
} from "@/lib/attachments";
import { Card, CardContent } from "@/components/ui/card";
import { Markdown } from "@/components/pgpals/markdown";
import {
  BonusBadge,
  CountdownBadge,
  PairBadge,
  PointsBadge,
  StatusBadge,
} from "@/components/pgpals/badges";
import { SubmissionForm } from "@/components/pgpals/submission-form";
import { PairPanel } from "@/components/pgpals/pair-panel";
import type { Pairing, Submission, Task } from "@/lib/types";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();

  if (!profile.team_id) {
    if (profile.role === "admin") redirect(`/admin/tasks/${id}`);
    redirect("/tasks");
  }

  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle<Task>();
  if (!task) notFound();

  const { data: subsData } = await supabase
    .from("submissions")
    .select("*")
    .eq("task_id", id)
    .order("submitted_at", { ascending: false });
  const submissions = (subsData ?? []) as Submission[];

  // Pair task state: the one live (pending/accepted) pairing involving us.
  let pairing: Pairing | null = null;
  let groupTeams: { id: string; name: string; accepted: boolean }[] = [];
  let availableTeams: { id: string; name: string }[] = [];
  if (task.type === "pair" && profile.team_id) {
    const { data: pairings } = await supabase
      .from("pairings")
      .select("*")
      .eq("task_id", id)
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: false });
    pairing = ((pairings ?? []) as Pairing[])[0] ?? null;
    if (pairing) {
      const { data: members } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", pairing.team_ids);
      groupTeams = (members ?? []).map((team) => ({
        ...team,
        accepted: pairing!.accepted_team_ids.includes(team.id),
      }));
    } else {
      const { data: available } = await supabase.rpc("available_partner_teams", {
        p_task: id,
      });
      availableTeams = available ?? [];
    }
  }

  const closed = isClosed(task.deadline_at);
  const live = submissions.filter((s) => s.status !== "superseded");
  const approvedCount = live.filter((s) => s.status === "approved").length;
  const hasPending = live.some((s) => s.status === "pending");
  const wasRejected = live.some((s) => s.status === "rejected");
  const canSubmit =
    !!profile.team_id &&
    !closed &&
    !hasPending &&
    approvedCount === 0 &&
    (task.type === "standard" || pairing?.status === "accepted");

  const attachmentUrlByPath = await getSignedAttachmentUrlMap(
    submissions.flatMap((s) => s.photo_paths)
  );
  const attachmentsBySubmission = new Map(
    submissions.map((s) => [
      s.id,
      signedAttachments(s.photo_paths, attachmentUrlByPath),
    ])
  );

  const bonusText = describeBonus(task.bonus_config);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All tasks
      </Link>

      <header className="space-y-3 border-b-2 border-dashed border-foreground/25 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">
              {task.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Deadline: {formatSGT(task.deadline_at)} SGT
            </p>
          </div>
          <PointsBadge points={task.points} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {task.type === "pair" && <PairBadge teamCount={task.pair_team_count} />}
          {task.bonus_config && <BonusBadge />}
          <CountdownBadge deadline={task.deadline_at} />
          {hasPending && <StatusBadge status="pending" />}
          {approvedCount > 0 && <StatusBadge status="approved" />}
          {wasRejected && !hasPending && approvedCount === 0 && (
            <StatusBadge status="rejected" />
          )}
        </div>
      </header>

      {bonusText && !closed && (
        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="text-sm font-semibold">
            {bonusText}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Markdown>{task.description}</Markdown>
        </CardContent>
      </Card>

      {task.type === "pair" && profile.team_id && approvedCount === 0 && (
        <PairPanel
          taskId={task.id}
          myTeamId={profile.team_id}
          pairing={pairing}
          groupTeams={groupTeams}
          requiredTeamCount={task.pair_team_count}
          availableTeams={availableTeams}
          closed={closed}
        />
      )}

      {canSubmit && (
        <SubmissionForm
          taskId={task.id}
          teamId={profile.team_id!}
          pairingId={task.type === "pair" ? (pairing?.id ?? null) : null}
          resubmit={wasRejected}
        />
      )}

      {hasPending && (
        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="text-sm">
            <span className="font-bold">Submitted!</span> Your proof is with
            the RAs. You&apos;ll see the result here.
          </CardContent>
        </Card>
      )}

      {closed && approvedCount === 0 && !hasPending && (
        <Card className="bg-muted">
          <CardContent className="text-center text-sm text-muted-foreground">
            This task has closed.
          </CardContent>
        </Card>
      )}

      {/* Status timeline */}
      {submissions.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-extrabold">Your submissions</h2>
          {submissions.map((s) => (
            <Card key={s.id}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={s.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatSGT(s.submitted_at)}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {(attachmentsBySubmission.get(s.id) ?? []).map((attachment, i) =>
                    attachment.url ? (
                      attachment.kind === "video" ? (
                        <video
                          key={attachment.path}
                          src={attachment.url}
                          controls
                          preload="metadata"
                          playsInline
                          className="h-40 max-w-72 shrink-0 rounded-md bg-foreground object-contain"
                        >
                          Your browser does not support video playback.
                        </video>
                      ) : (
                        <a
                          key={attachment.path}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={attachment.url}
                            alt={`Photo ${i + 1}`}
                            className="h-24 w-24 shrink-0 rounded-md object-cover"
                          />
                        </a>
                      )
                    ) : null
                  )}
                </div>
                {s.text_content && (
                  <p className="text-sm text-muted-foreground">
                    &quot;{s.text_content}&quot;
                  </p>
                )}
                {s.status === "approved" && s.points_awarded != null && (
                  <p className="text-sm font-bold text-primary">
                    +{s.points_awarded} PGP Coins earned
                  </p>
                )}
                {s.status !== "pending" && s.review_note && (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    <span className="font-semibold">RA note:</span>{" "}
                    {s.review_note}
                  </div>
                )}
                {s.status === "rejected" && !closed && (
                  <p className="text-sm font-semibold text-destructive">
                    You can fix this and resubmit above until the deadline.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
