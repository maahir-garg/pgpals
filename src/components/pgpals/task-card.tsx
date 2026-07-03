import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { SubmissionStatus, Task } from "@/lib/types";
import {
  BonusBadge,
  CountdownBadge,
  PairBadge,
  PointsBadge,
  StatusBadge,
} from "@/components/pgpals/badges";

export function TaskCard({
  task,
  status,
  closed,
}: {
  task: Task;
  status: SubmissionStatus | null;
  closed: boolean;
}) {
  return (
    <Link href={`/tasks/${task.id}`} className="block">
      <Card
        className={
          "min-h-36 gap-3 rounded-xl p-4 transition-bouncy hover:-rotate-1 hover:scale-[1.02] " +
          (closed && status !== "approved" ? "opacity-70" : "")
        }
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-base font-bold leading-snug">{task.title}</h3>
          <PointsBadge points={task.points} />
        </div>
        <div className="flex flex-1 flex-col justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {task.type === "pair" && <PairBadge />}
            {task.bonus_config && !closed && <BonusBadge />}
            <CountdownBadge deadline={task.deadline_at} />
            {status && <StatusBadge status={status} />}
          </div>
          <div className="flex items-center justify-between border-t pt-3 text-xs font-semibold text-muted-foreground">
            <span>
              {closed
                ? "See what happened"
                : status === "approved"
                  ? "View submission"
                  : status === "rejected"
                    ? "Fix and resubmit"
                    : status === "pending"
                      ? "Waiting for review"
                      : "Open task"}
            </span>
            <ArrowRight className="size-4" aria-hidden />
          </div>
        </div>
      </Card>
    </Link>
  );
}
