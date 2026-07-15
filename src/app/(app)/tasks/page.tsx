import Link from "next/link";
import type { Metadata } from "next";
import { Shield, UserPlus } from "lucide-react";
import { requireProfile } from "@/lib/data";
import { approvedCountMap, taskStatusMap, isClosed } from "@/lib/status";
import { isClosingSoon } from "@/lib/datetime";
import { TaskCard, type TaskCardTask } from "@/components/pgpals/task-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Submission, Task } from "@/lib/types";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const { supabase, profile } = await requireProfile();

  if (!profile.team_id) {
    const isAdmin = profile.role === "admin";
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <section className="rounded-xl border-2 border-foreground bg-card p-6 shadow-sticker">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-foreground bg-primary text-primary-foreground">
              {isAdmin ? (
                <Shield className="size-5" strokeWidth={2.5} aria-hidden />
              ) : (
                <UserPlus className="size-5" strokeWidth={2.5} aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight">Tasks</h1>
              {isAdmin ? (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Participant tasks are team-scoped. Since you&apos;re not
                    playing on a team, manage tasks from the admin console
                    instead.
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/admin/tasks">
                      <Shield className="size-4" aria-hidden />
                      Open admin tasks
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  You&apos;re not on a team yet, so tasks are locked for now.
                  Ask your RA to add you to the roster and you&apos;ll see the
                  challenge board here.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const [{ data: tasks }, { data: submissions }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, points, type, pair_team_count, deadline_at, bonus_config, max_submissions"),
    supabase.from("submissions").select("task_id, status"),
  ]);

  type TaskListTask = TaskCardTask & Pick<Task, "max_submissions">;
  const allTasks = (tasks ?? []) as TaskListTask[];
  const allSubs = (submissions ?? []) as Pick<Submission, "task_id" | "status">[];
  const statusByTask = taskStatusMap(allSubs);
  const approvedByTask = approvedCountMap(allSubs);

  // "Done" means no more points available: every allowed approval is used.
  // Repeatable tasks (max_submissions > 1) stay open until then.
  const isDone = (t: TaskListTask) =>
    (approvedByTask.get(t.id) ?? 0) >= t.max_submissions;

  const open = allTasks.filter((t) => !isClosed(t.deadline_at) && !isDone(t));
  const closingSoon = open
    .filter((t) => isClosingSoon(t.deadline_at))
    .sort((a, b) => a.deadline_at.localeCompare(b.deadline_at));
  const active = open
    .filter((t) => !isClosingSoon(t.deadline_at))
    .sort((a, b) => a.deadline_at.localeCompare(b.deadline_at));
  const done = allTasks
    .filter((t) => isDone(t))
    .sort((a, b) => b.deadline_at.localeCompare(a.deadline_at));
  const closed = allTasks
    .filter((t) => isClosed(t.deadline_at) && !isDone(t))
    .sort((a, b) => b.deadline_at.localeCompare(a.deadline_at));

  const groups = [
    { title: "Closing soon", tasks: closingSoon },
    { title: "Open", tasks: active },
    { title: "Done", tasks: done },
    { title: "Closed", tasks: closed },
  ].filter((g) => g.tasks.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b-2 border-dashed border-foreground/25 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your challenge board. Deadlines are SGT.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="h-7">
            {open.length} open
          </Badge>
          <Badge variant="outline" className="h-7">
            {done.length} done
          </Badge>
        </div>
      </div>
      {groups.length === 0 && (
        <p className="rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
          No tasks released yet. The fun starts soon.
        </p>
      )}
      {groups.map((group) => (
        <section key={group.title} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{group.title}</h2>
            <Badge variant="outline">{group.tasks.length}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
            {group.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                status={statusByTask.get(task.id) ?? null}
                closed={isClosed(task.deadline_at)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
