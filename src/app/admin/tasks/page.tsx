import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data";
import { formatSGT } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Submission, Task } from "@/lib/types";

export const metadata: Metadata = { title: "Tasks" };

export default async function AdminTasksPage() {
  const { supabase } = await requireAdmin();
  const [{ data: tasksData }, { data: subsData }] = await Promise.all([
    supabase.from("tasks").select("*").order("release_at", { ascending: false }),
    supabase.from("submissions").select("task_id, status"),
  ]);
  const tasks = (tasksData ?? []) as Task[];
  const subs = (subsData ?? []) as Pick<Submission, "task_id" | "status">[];

  const counts = new Map<string, { pending: number; approved: number }>();
  for (const s of subs) {
    const c = counts.get(s.task_id) ?? { pending: 0, approved: 0 };
    if (s.status === "pending") c.pending++;
    if (s.status === "approved") c.approved++;
    counts.set(s.task_id, c);
  }

  const now = Date.now();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Tasks</h1>
        <Button asChild className="rounded-xl font-bold">
          <Link href="/admin/tasks/new">+ New task</Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Pts</TableHead>
              <TableHead>Release (SGT)</TableHead>
              <TableHead>Deadline (SGT)</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Subs ✅/🕐</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const c = counts.get(task.id) ?? { pending: 0, approved: 0 };
              const state = !task.is_published
                ? { label: "Draft", cls: "bg-muted text-muted-foreground" }
                : new Date(task.release_at).getTime() > now
                  ? { label: "Scheduled", cls: "bg-chart-3/25" }
                  : new Date(task.deadline_at).getTime() < now
                    ? { label: "Closed", cls: "bg-muted text-muted-foreground" }
                    : { label: "Live", cls: "bg-chart-5/25" };
              return (
                <TableRow key={task.id}>
                  <TableCell>
                    <Link
                      href={`/admin/tasks/${task.id}`}
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {task.type === "pair" && "🤝 "}
                      {task.title}
                    </Link>
                    {task.bonus_config && " ⚡"}
                  </TableCell>
                  <TableCell className="font-semibold">{task.points}</TableCell>
                  <TableCell className="text-sm">{formatSGT(task.release_at)}</TableCell>
                  <TableCell className="text-sm">{formatSGT(task.deadline_at)}</TableCell>
                  <TableCell>
                    <Badge className={`rounded-full ${state.cls}`}>{state.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    {c.approved} / {c.pending}
                  </TableCell>
                </TableRow>
              );
            })}
            {tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No tasks yet. Create the first one!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
