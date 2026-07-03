import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data";
import { TaskForm } from "../task-form";
import type { Task } from "@/lib/types";

export const metadata: Metadata = { title: "Edit task" };

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle<Task>();
  if (!task) notFound();

  const { count: pending } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("task_id", id)
    .eq("status", "pending");

  return (
    <div className="space-y-4">
      <div className="border-b pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit task</h1>
      </div>
      {(pending ?? 0) > 0 && (
        <p className="max-w-2xl rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground">
          {pending} submission{pending === 1 ? "" : "s"} waiting.{" "}
          <Link href={`/admin/review?task=${id}`} className="underline">
            review them
          </Link>
        </p>
      )}
      <TaskForm task={task} />
    </div>
  );
}
