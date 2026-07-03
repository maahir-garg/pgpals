import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data";
import { TaskForm } from "../task-form";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <div className="border-b-2 border-dashed border-foreground/25 pb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New task</h1>
      </div>
      <TaskForm task={null} />
    </div>
  );
}
