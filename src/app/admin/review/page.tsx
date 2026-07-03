import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data";
import { getSignedPhotoUrls } from "@/lib/photos";
import { formatSGT } from "@/lib/datetime";
import { describeBonus } from "@/lib/bonus";
import { ReviewCard } from "./review-card";
import type { BonusConfig, Pairing, Submission, Task, Team } from "@/lib/types";

export const metadata: Metadata = { title: "Review queue" };

const STATUSES = ["pending", "approved", "rejected", "superseded"] as const;

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
  searchParams: Promise<{ status?: string; task?: string; team?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : "pending";

  let query = supabase
    .from("submissions")
    .select("*")
    .eq("status", status)
    .order("submitted_at", { ascending: true })
    .limit(50);
  if (params.task) query = query.eq("task_id", params.task);
  if (params.team) query = query.eq("team_id", params.team);

  const [{ data: subsData }, { data: tasksData }, { data: teamsData }, { data: pairingsData }, { data: approvedData }] =
    await Promise.all([
      query,
      supabase.from("tasks").select("*").order("release_at"),
      supabase.from("teams").select("*").order("name"),
      supabase.from("pairings").select("*"),
      supabase.from("submissions").select("task_id").eq("status", "approved"),
    ]);

  const submissions = (subsData ?? []) as Submission[];
  const tasks = (tasksData ?? []) as Task[];
  const teams = (teamsData ?? []) as Team[];
  const pairings = (pairingsData ?? []) as Pairing[];

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const pairingById = new Map(pairings.map((p) => [p.id, p]));
  const approvedCountByTask = new Map<string, number>();
  for (const s of approvedData ?? []) {
    approvedCountByTask.set(
      s.task_id,
      (approvedCountByTask.get(s.task_id) ?? 0) + 1
    );
  }

  const cards = await Promise.all(
    submissions.map(async (s) => {
      const task = taskById.get(s.task_id);
      const pairing = s.pairing_id ? pairingById.get(s.pairing_id) : null;
      const partnerTeamId = pairing
        ? pairing.team_a === s.team_id
          ? pairing.team_b
          : pairing.team_a
        : null;
      return {
        submission: s,
        photoUrls: await getSignedPhotoUrls(s.photo_paths),
        taskTitle: task?.title ?? "(deleted task)",
        basePoints: task?.points ?? 0,
        bonusNote: task ? describeBonus(task.bonus_config) : null,
        preview: task ? previewPoints(task, s, approvedCountByTask) : 0,
        teamLabel:
          (teamName.get(s.team_id) ?? "?") +
          (partnerTeamId ? ` 🤝 ${teamName.get(partnerTeamId) ?? "?"}` : ""),
        submittedAt: formatSGT(s.submitted_at),
        reviewedAt: s.reviewed_at ? formatSGT(s.reviewed_at) : null,
      };
    })
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Review queue</h1>

      {/* Filters (plain GET form) */}
      <form className="flex flex-wrap items-center gap-2" method="get">
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-xl border bg-card px-3 text-sm font-semibold"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          name="task"
          defaultValue={params.task ?? ""}
          className="h-9 max-w-56 rounded-xl border bg-card px-3 text-sm font-semibold"
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
          className="h-9 max-w-56 rounded-xl border bg-card px-3 text-sm font-semibold"
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
          className="h-9 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          Filter
        </button>
      </form>

      {cards.length === 0 ? (
        <div className="rounded-2xl bg-muted p-10 text-center">
          <div className="text-4xl">🎉</div>
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
      {cards.length === 50 && (
        <p className="text-center text-sm text-muted-foreground">
          Showing the oldest 50. Clear some to see more.
        </p>
      )}
    </div>
  );
}
