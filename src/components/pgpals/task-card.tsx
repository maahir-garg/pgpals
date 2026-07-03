import Link from "next/link";
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
          "gap-2 rounded-2xl p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md " +
          (closed && status !== "approved" ? "opacity-70" : "")
        }
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold leading-snug">{task.title}</h3>
          <PointsBadge points={task.points} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {task.type === "pair" && <PairBadge />}
          {task.bonus_config && !closed && <BonusBadge />}
          <CountdownBadge deadline={task.deadline_at} />
          {status && <StatusBadge status={status} />}
        </div>
      </Card>
    </Link>
  );
}
