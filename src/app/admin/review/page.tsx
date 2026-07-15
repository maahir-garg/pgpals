import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { requireAdmin } from "@/lib/data";
import {
  getSignedAttachmentUrlMap,
  signedAttachments,
} from "@/lib/attachments";
import { formatSGT } from "@/lib/datetime";
import { describeBonus } from "@/lib/bonus";
import { cn } from "@/lib/utils";
import { ReviewCard } from "./review-card";
import type { BonusConfig, Pairing, Submission, Task, Team } from "@/lib/types";

export const metadata: Metadata = { title: "Review queue" };

const STATUSES = ["pending", "approved", "rejected", "superseded"] as const;
const PAGE_SIZE = 50;
const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  superseded: "Replaced",
};

// Mirrors the database's compute_award() for display only; the authoritative
// number is computed inside the review_submission RPC at approval time.
function previewPoints(
  task: Task,
  submission: Submission,
  approvedCountByTask: Map<string, number>
): number {
  const cfg = task.bonus_config as BonusConfig | null;
  if (!cfg) return task.points;
  if (cfg.kind === "first_n") {
    return (approvedCountByTask.get(task.id) ?? 0) < cfg.n
      ? task.points + cfg.bonus
      : task.points;
  }
  if (cfg.kind === "before") {
    return new Date(submission.submitted_at) <= new Date(cfg.cutoff)
      ? task.points + cfg.bonus
      : task.points;
  }
  if (cfg.kind === "multiplier_before") {
    return new Date(submission.submitted_at) <= new Date(cfg.cutoff)
      ? Math.round(task.points * cfg.multiplier)
      : task.points;
  }
  return task.points;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    task?: string;
    team?: string;
    page?: string;
  }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : "pending";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("submissions")
    .select("*")
    .eq("status", status)
    .order("submitted_at", { ascending: true })
    .range(from, to);
  if (params.task) query = query.eq("task_id", params.task);
  if (params.team) query = query.eq("team_id", params.team);

  const [
    { data: subsData },
    { data: tasksData },
    { data: teamsData },
    { data: approvedCountsData },
    { data: statusCountsData },
  ] = await Promise.all([
    query,
    supabase.from("tasks").select("*").order("release_at"),
    supabase.from("teams").select("*").order("name"),
    supabase.rpc("admin_submission_counts_by_task"),
    supabase.rpc("admin_submission_status_counts", {
      p_task: params.task || null,
      p_team: params.team || null,
    }),
  ]);

  const submissions = (subsData ?? []) as Submission[];
  const tasks = (tasksData ?? []) as Task[];
  const teams = (teamsData ?? []) as Team[];
  const pairingIds = [
    ...new Set(submissions.map((s) => s.pairing_id).filter(Boolean)),
  ] as string[];
  const [{ data: pairingsData }, attachmentUrlByPath] = await Promise.all([
    pairingIds.length > 0
      ? supabase.from("pairings").select("*").in("id", pairingIds)
      : Promise.resolve({ data: [] as Pairing[] }),
    getSignedAttachmentUrlMap(submissions.flatMap((s) => s.photo_paths)),
  ]);
  const pairings = (pairingsData ?? []) as Pairing[];
  const countByStatus = new Map<(typeof STATUSES)[number], number>(
    STATUSES.map((s) => [s, 0])
  );
  for (const row of statusCountsData ?? []) {
    if (STATUSES.includes(row.status as (typeof STATUSES)[number])) {
      countByStatus.set(
        row.status as (typeof STATUSES)[number],
        Number(row.count)
      );
    }
  }

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const pairingById = new Map(pairings.map((p) => [p.id, p]));
  const approvedCountByTask = new Map<string, number>();
  for (const row of approvedCountsData ?? []) {
    approvedCountByTask.set(row.task_id, Number(row.approved_count));
  }

  const cards = submissions.map((s) => {
    const task = taskById.get(s.task_id);
    const pairing = s.pairing_id ? pairingById.get(s.pairing_id) : null;
    const creditedTeamIds = pairing?.team_ids ?? [s.team_id];
    return {
      submission: s,
      attachments: signedAttachments(s.photo_paths, attachmentUrlByPath),
      taskTitle: task?.title ?? "(deleted task)",
      basePoints: task?.points ?? 0,
      bonusNote: task ? describeBonus(task.bonus_config) : null,
      preview: task ? previewPoints(task, s, approvedCountByTask) : 0,
      teamLabel: creditedTeamIds.map((id) => teamName.get(id) ?? "?").join(" + "),
      submittedAt: formatSGT(s.submitted_at),
      reviewedAt: s.reviewed_at ? formatSGT(s.reviewed_at) : null,
    };
  });

  // Tab links keep the current task/team filters.
  const tabHref = (s: (typeof STATUSES)[number]) => {
    const qs = new URLSearchParams();
    if (s !== "pending") qs.set("status", s);
    if (params.task) qs.set("task", params.task);
    if (params.team) qs.set("team", params.team);
    const str = qs.toString();
    return `/admin/review${str ? `?${str}` : ""}`;
  };
  const pageHref = (targetPage: number) => {
    const qs = new URLSearchParams();
    if (status !== "pending") qs.set("status", status);
    if (params.task) qs.set("task", params.task);
    if (params.team) qs.set("team", params.team);
    if (targetPage > 1) qs.set("page", String(targetPage));
    const str = qs.toString();
    return `/admin/review${str ? `?${str}` : ""}`;
  };
  const totalForStatus = countByStatus.get(status) ?? 0;
  const hasPreviousPage = page > 1;
  const hasNextPage = page * PAGE_SIZE < totalForStatus;
  const displayStart = cards.length > 0 ? from + 1 : 0;
  const displayEnd = cards.length > 0 ? from + cards.length : 0;

  return (
    <div className="space-y-4">
      <div className="border-b-2 border-dashed border-foreground/25 pb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Review queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Oldest submissions first. Approvals award coins immediately;
          rejections need a note the team will see.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-lg bg-muted p-1">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={tabHref(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
                s === status && "bg-card text-foreground shadow-sm"
              )}
            >
              {STATUS_LABELS[s]}
              <span
                className={cn(
                  "ml-1.5 text-xs font-bold",
                  s === "pending" && (countByStatus.get(s) ?? 0) > 0
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {countByStatus.get(s)}
              </span>
            </Link>
          ))}
        </nav>

        {/* Task/team filters (plain GET form) */}
        <form className="flex flex-wrap items-center gap-2" method="get">
          <input type="hidden" name="status" value={status} />
          <select
            name="task"
            defaultValue={params.task ?? ""}
            className="h-9 max-w-52 rounded-lg border-2 border-input bg-card px-3 text-sm font-semibold outline-none focus-visible:border-primary"
          >
            <option value="">All tasks</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <select
            name="team"
            defaultValue={params.team ?? ""}
            className="h-9 max-w-52 rounded-lg border-2 border-input bg-card px-3 text-sm font-semibold outline-none focus-visible:border-primary"
          >
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-9 rounded-full border-2 border-foreground bg-card px-4 text-sm font-bold transition-colors hover:bg-accent"
          >
            Apply
          </button>
        </form>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border-2 border-foreground bg-card p-10 shadow-sticker text-center">
          <ClipboardCheck className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-2 font-semibold">
            {status === "pending" ? "Queue is clear. Nice work!" : "Nothing here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((card) => (
            <ReviewCard key={card.submission.id} {...card} status={status} />
          ))}
        </div>
      )}
      {(hasPreviousPage || hasNextPage || totalForStatus > PAGE_SIZE) && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          {hasPreviousPage ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded-full border-2 border-foreground bg-card px-4 py-2 font-bold transition-colors hover:bg-accent"
            >
              Previous
            </Link>
          ) : null}
          <span className="font-semibold text-muted-foreground">
            Showing {displayStart}-{displayEnd} of {totalForStatus}
          </span>
          {hasNextPage ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded-full border-2 border-foreground bg-card px-4 py-2 font-bold transition-colors hover:bg-accent"
            >
              Next
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
