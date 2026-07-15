import type { Submission, SubmissionStatus } from "@/lib/types";

type SubmissionStatusRow = Pick<Submission, "task_id" | "status">;

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

export function isClosed(deadlineAt: string, now = new Date()): boolean {
  return new Date(deadlineAt).getTime() < now.getTime();
}
