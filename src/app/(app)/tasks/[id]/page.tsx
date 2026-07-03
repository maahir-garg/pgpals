import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/data";
import { isClosed } from "@/lib/status";
import { formatSGT } from "@/lib/datetime";
import { describeBonus } from "@/lib/bonus";
import { getSignedPhotoUrls } from "@/lib/photos";
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
  let partnerName: string | null = null;
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
      const partnerId =
        pairing.team_a === profile.team_id ? pairing.team_b : pairing.team_a;
      const { data: partner } = await supabase
        .from("teams")
        .select("name")
        .eq("id", partnerId)
        .single();
      partnerName = partner?.name ?? "another team";
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
    approvedCount < task.max_submissions &&
    (task.type === "standard" || pairing?.status === "accepted");

  const photoUrlsBySubmission = new Map<string, string[]>();
  for (const s of submissions) {
    photoUrlsBySubmission.set(s.id, await getSignedPhotoUrls(s.photo_paths));
  }

  const bonusText = describeBonus(task.bonus_config);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/tasks"
        className="inline-block text-sm font-semibold text-muted-foreground"
      >
        ← All tasks
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold leading-tight">{task.title}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <PointsBadge points={task.points} />
          {task.type === "pair" && <PairBadge />}
          {task.bonus_config && <BonusBadge />}
          <CountdownBadge deadline={task.deadline_at} />
        </div>
        <p className="text-xs text-muted-foreground">
          Deadline: {formatSGT(task.deadline_at)} SGT
        </p>
      </div>

      {bonusText && !closed && (
        <Card className="rounded-2xl border-none bg-chart-3/20">
          <CardContent className="pt-4 text-sm font-semibold">
            {bonusText}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardContent className="pt-5">
          <Markdown>{task.description}</Markdown>
        </CardContent>
      </Card>

      {task.type === "pair" && profile.team_id && approvedCount === 0 && (
        <PairPanel
          taskId={task.id}
          myTeamId={profile.team_id}
          pairing={pairing}
          partnerName={partnerName}
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

      {closed && approvedCount === 0 && !hasPending && (
        <Card className="rounded-2xl bg-muted">
          <CardContent className="pt-5 text-center text-sm text-muted-foreground">
            This task has closed. 🌙
          </CardContent>
        </Card>
      )}

      {/* Status timeline */}
      {submissions.length > 0 && (
        <div className="space-y-2">
          <h3 className="px-1 font-bold">📜 Your submissions</h3>
          {submissions.map((s) => (
            <Card key={s.id} className="rounded-2xl">
              <CardContent className="space-y-2.5 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={s.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatSGT(s.submitted_at)}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {(photoUrlsBySubmission.get(s.id) ?? []).map((url, i) =>
                    url ? (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="h-24 w-24 shrink-0 rounded-xl object-cover"
                        />
                      </a>
                    ) : null
                  )}
                </div>
                {s.text_content && (
                  <p className="text-sm text-muted-foreground">
                    “{s.text_content}”
                  </p>
                )}
                {s.status === "approved" && s.points_awarded != null && (
                  <p className="text-sm font-bold text-primary">
                    +{s.points_awarded} points awarded 🎉
                  </p>
                )}
                {s.status !== "pending" && s.review_note && (
                  <div className="rounded-xl bg-muted p-3 text-sm">
                    <span className="font-semibold">RA note:</span>{" "}
                    {s.review_note}
                  </div>
                )}
                {s.status === "rejected" && !closed && (
                  <p className="text-sm font-semibold text-destructive">
                    You can fix this and resubmit above until the deadline! 💪
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
