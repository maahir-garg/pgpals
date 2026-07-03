import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Users, Zap } from "lucide-react";
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
      <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-foreground/25 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Publish state, deadlines, and review counts.
          </p>
        </div>
        <Button asChild className="font-bold">
          <Link href="/admin/tasks/new">
            <Plus className="size-4" aria-hidden />
            New task
          </Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border-2 border-foreground bg-card shadow-sticker">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Coins</TableHead>
              <TableHead>Release (SGT)</TableHead>
              <TableHead>Deadline (SGT)</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead className="text-right">Pending</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const c = counts.get(task.id) ?? { pending: 0, approved: 0 };
              const state = !task.is_published
                ? { label: "Draft", cls: "bg-muted text-muted-foreground" }
                : new Date(task.release_at).getTime() > now
                  ? { label: "Scheduled", cls: "bg-warning/15 text-warning" }
                  : new Date(task.deadline_at).getTime() < now
                    ? { label: "Closed", cls: "bg-muted text-muted-foreground" }
                    : { label: "Live", cls: "bg-success/15 text-success" };
              return (
                <TableRow key={task.id}>
                  <TableCell>
                    <Link
                      href={`/admin/tasks/${task.id}`}
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {task.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {task.type === "pair" && (
                        <Badge variant="outline">
                          <Users className="size-3" aria-hidden />
                          Pair
                        </Badge>
                      )}
                      {task.bonus_config && (
                        <Badge variant="outline">
                          <Zap className="size-3" aria-hidden />
                          Bonus
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{task.points}</TableCell>
                  <TableCell className="text-sm">{formatSGT(task.release_at)}</TableCell>
                  <TableCell className="text-sm">{formatSGT(task.deadline_at)}</TableCell>
                  <TableCell>
                    <Badge className={state.cls}>{state.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-success">
                    {c.approved}
                  </TableCell>
                  <TableCell
                    className={
                      "text-right text-sm font-semibold " +
                      (c.pending > 0 ? "text-warning" : "text-muted-foreground")
                    }
                  >
                    {c.pending > 0 ? (
                      <Link
                        href={`/admin/review?task=${task.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {c.pending}
                      </Link>
                    ) : (
                      c.pending
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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
