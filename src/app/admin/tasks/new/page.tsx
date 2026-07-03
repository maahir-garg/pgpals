import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data";
import { TaskForm } from "../task-form";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">New task</h1>
      <TaskForm task={null} />
    </div>
  );
}
