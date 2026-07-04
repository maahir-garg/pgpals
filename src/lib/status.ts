import type { Submission, SubmissionStatus } from "@/lib/types";

type SubmissionStatusRow = Pick<Submission, "task_id" | "status">;

// A team's effective status for a task, from the submissions they can see
// (own + joint pair submissions). Superseded rows are history only.
export function taskStatusFor(
  taskId: string,
  submissions: SubmissionStatusRow[]
): SubmissionStatus | null {
  const live = submissions.filter(
    (s) => s.task_id === taskId && s.status !== "superseded"
  );
  if (live.some((s) => s.status === "approved")) return "approved";
  if (live.some((s) => s.status === "pending")) return "pending";
  if (live.some((s) => s.status === "rejected")) return "rejected";
  return null;
}

export function taskStatusMap(
  submissions: SubmissionStatusRow[]
): Map<string, SubmissionStatus> {
  const priority: Record<SubmissionStatus, number> = {
    superseded: 0,
    rejected: 1,
    pending: 2,
    approved: 3,
  };
  const result = new Map<string, SubmissionStatus>();

  for (const submission of submissions) {
    if (submission.status === "superseded") continue;
    const current = result.get(submission.task_id);
    if (!current || priority[submission.status] > priority[current]) {
      result.set(submission.task_id, submission.status);
    }
  }

  return result;
}

export function approvedCountMap(
  submissions: SubmissionStatusRow[]
): Map<string, number> {
  const result = new Map<string, number>();
  for (const submission of submissions) {
    if (submission.status !== "approved") continue;
    result.set(
      submission.task_id,
      (result.get(submission.task_id) ?? 0) + 1
    );
  }
  return result;
}

export function isClosed(deadlineAt: string, now = new Date()): boolean {
  return new Date(deadlineAt).getTime() < now.getTime();
}
