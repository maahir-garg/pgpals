import type { Metadata } from "next";
import { requireProfile } from "@/lib/data";
import { taskStatusFor, isClosed } from "@/lib/status";
import { isClosingSoon } from "@/lib/datetime";
import { TaskCard } from "@/components/pgpals/task-card";
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

  const closingSoon = allTasks
    .filter((t) => !isClosed(t.deadline_at) && isClosingSoon(t.deadline_at))
    .sort((a, b) => a.deadline_at.localeCompare(b.deadline_at));
  const active = allTasks
    .filter((t) => !isClosed(t.deadline_at) && !isClosingSoon(t.deadline_at))
    .sort((a, b) => a.deadline_at.localeCompare(b.deadline_at));
  const closed = allTasks
    .filter((t) => isClosed(t.deadline_at))
    .sort((a, b) => b.deadline_at.localeCompare(a.deadline_at));

  const groups = [
    { title: "🔥 Closing soon", tasks: closingSoon },
    { title: "🎯 Active", tasks: active },
    { title: "🌙 Closed", tasks: closed },
  ].filter((g) => g.tasks.length > 0);

  return (
    <div className="space-y-6">
      <h1 className="px-1 text-2xl font-extrabold">Tasks</h1>
      {groups.length === 0 && (
        <p className="rounded-2xl bg-muted p-6 text-center text-sm text-muted-foreground">
          No tasks released yet. The fun starts soon! 🐣
        </p>
      )}
      {groups.map((group) => (
        <section key={group.title} className="space-y-2">
          <h2 className="px-1 font-bold text-muted-foreground">{group.title}</h2>
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
