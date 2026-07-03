import type { Submission, SubmissionStatus } from "@/lib/types";

// A team's effective status for a task, from the submissions they can see
// (own + joint pair submissions). Superseded rows are history only.
export function taskStatusFor(
  taskId: string,
  submissions: Submission[]
): SubmissionStatus | null {
  const live = submissions.filter(
    (s) => s.task_id === taskId && s.status !== "superseded"
  );
  if (live.some((s) => s.status === "approved")) return "approved";
  if (live.some((s) => s.status === "pending")) return "pending";
  if (live.some((s) => s.status === "rejected")) return "rejected";
  return null;
}

export function isClosed(deadlineAt: string, now = new Date()): boolean {
  return new Date(deadlineAt).getTime() < now.getTime();
}
