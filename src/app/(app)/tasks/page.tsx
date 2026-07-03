import type { Metadata } from "next";
import { requireProfile } from "@/lib/data";
import { taskStatusFor, isClosed } from "@/lib/status";
import { isClosingSoon } from "@/lib/datetime";
import { TaskCard } from "@/components/pgpals/task-card";
import { Badge } from "@/components/ui/badge";
import type { Submission, Task } from "@/lib/types";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const { supabase } = await requireProfile();

  const [{ data: tasks }, { data: submissions }] = await Promise.all([
    supabase.from("tasks").select("*"),
    supabase.from("submissions").select("*"),
  ]);

  const allTasks = (tasks ?? []) as Task[];
  const allSubs = (submissions ?? []) as Submission[];

  // "Done" means no more points available: every allowed approval is used.
  // Repeatable tasks (max_submissions > 1) stay open until then.
  const approvedCount = (t: Task) =>
    allSubs.filter(
      (s) => s.task_id === t.id && s.status === "approved"
    ).length;
  const isDone = (t: Task) => approvedCount(t) >= t.max_submissions;

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
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your challenge board. Deadlines are SGT.
          </p>
        </div>
        <div className="flex gap-2">
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
          <div className="grid gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-3">
            {group.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                status={taskStatusFor(task.id, allSubs)}
                closed={isClosed(task.deadline_at)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
