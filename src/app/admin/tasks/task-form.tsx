"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTask, deleteTask, updateTask, type TaskInput } from "../actions";
import { utcToSgtInput } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { BonusConfig, Task } from "@/lib/types";

type BonusKind = "none" | BonusConfig["kind"];

export function TaskForm({ task }: { task: Task | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [points, setPoints] = useState(String(task?.points ?? 10));
  const [type, setType] = useState<"standard" | "pair">(task?.type ?? "standard");
  const [releaseAt, setReleaseAt] = useState(
    task ? utcToSgtInput(task.release_at) : ""
  );
  const [deadlineAt, setDeadlineAt] = useState(
    task ? utcToSgtInput(task.deadline_at) : ""
  );
  const [maxSubmissions, setMaxSubmissions] = useState(
    String(task?.max_submissions ?? 1)
  );
  const [isPublished, setIsPublished] = useState(task?.is_published ?? true);

  const existingBonus = task?.bonus_config ?? null;
  const [bonusKind, setBonusKind] = useState<BonusKind>(
    existingBonus?.kind ?? "none"
  );
  const [bonusN, setBonusN] = useState(
    existingBonus?.kind === "first_n" ? String(existingBonus.n) : "10"
  );
  const [bonusPoints, setBonusPoints] = useState(
    existingBonus && "bonus" in existingBonus ? String(existingBonus.bonus) : "5"
  );
  const [bonusCutoff, setBonusCutoff] = useState(
    existingBonus && "cutoff" in existingBonus
      ? utcToSgtInput(existingBonus.cutoff)
      : ""
  );
  const [bonusMultiplier, setBonusMultiplier] = useState(
    existingBonus?.kind === "multiplier_before"
      ? String(existingBonus.multiplier)
      : "1.5"
  );

  function buildBonus(): BonusConfig | null | "invalid" {
    if (bonusKind === "none") return null;
    if (bonusKind === "first_n") {
      const n = Number(bonusN);
      const bonus = Number(bonusPoints);
      if (!Number.isInteger(n) || n < 1 || !Number.isInteger(bonus) || bonus < 1)
        return "invalid";
      return { kind: "first_n", n, bonus };
    }
    if (!bonusCutoff) return "invalid";
    // Cutoff entered in SGT; stored as UTC ISO inside the config JSON.
    const cutoff = new Date(`${bonusCutoff}:00+08:00`).toISOString();
    if (bonusKind === "before") {
      const bonus = Number(bonusPoints);
      if (!Number.isInteger(bonus) || bonus < 1) return "invalid";
      return { kind: "before", cutoff, bonus };
    }
    const multiplier = Number(bonusMultiplier);
    if (!(multiplier > 1)) return "invalid";
    return { kind: "multiplier_before", cutoff, multiplier };
  }

  function save() {
    const pts = Number(points);
    const maxSubs = Number(maxSubmissions);
    if (!title.trim()) return void toast.error("Title is required.");
    if (!Number.isInteger(pts) || pts < 0)
      return void toast.error("Points must be a whole number ≥ 0.");
    if (!releaseAt || !deadlineAt)
      return void toast.error("Set both release and deadline times.");
    if (new Date(deadlineAt) <= new Date(releaseAt))
      return void toast.error("Deadline must be after release.");
    if (!Number.isInteger(maxSubs) || maxSubs < 1)
      return void toast.error("Max submissions must be ≥ 1.");
    const bonusConfig = buildBonus();
    if (bonusConfig === "invalid")
      return void toast.error("Bonus settings are incomplete.");

    const input: TaskInput = {
      title,
      description,
      points: pts,
      type,
      releaseAtSgt: releaseAt,
      deadlineAtSgt: deadlineAt,
      maxSubmissions: maxSubs,
      isPublished,
      bonusConfig,
    };

    startTransition(async () => {
      const result = task
        ? await updateTask(task.id, input)
        : await createTask(input);
      if (result.ok) {
        toast.success(result.message);
        router.push("/admin/tasks");
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    if (!task) return;
    if (!confirm(`Delete "${task.title}" and ALL its submissions? This cannot be undone.`))
      return;
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (result.ok) {
        toast.success(result.message);
        router.push("/admin/tasks");
      } else {
        toast.error(result.error);
      }
    });
  }

  const inputCls = "h-10";

  return (
    <Card className="max-w-2xl">
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sunset selfie at the Mound"
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description (markdown)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder={"What to do, what counts as proof..."}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="points">Base points</Label>
            <Input
              id="points"
              type="number"
              min={0}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as "standard" | "pair")}
              className="h-10 w-full rounded-lg border-2 border-input bg-card px-3 text-sm outline-none focus-visible:border-primary"
            >
              <option value="standard">Standard</option>
              <option value="pair">Pair (two teams)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxsubs">Max approvals</Label>
            <Input
              id="maxsubs"
              type="number"
              min={1}
              value={maxSubmissions}
              onChange={(e) => setMaxSubmissions(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="release">Release (SGT)</Label>
            <Input
              id="release"
              type="datetime-local"
              value={releaseAt}
              onChange={(e) => setReleaseAt(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deadline">Deadline (SGT)</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={deadlineAt}
              onChange={(e) => setDeadlineAt(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg bg-muted p-4">
          <Label htmlFor="bonuskind">Bonus (optional)</Label>
          <select
            id="bonuskind"
            value={bonusKind}
            onChange={(e) => setBonusKind(e.target.value as BonusKind)}
            className="h-10 w-full rounded-lg border-2 border-input bg-card px-3 text-sm outline-none focus-visible:border-primary"
          >
            <option value="none">No bonus</option>
            <option value="first_n">Early bird: first N approved get +X</option>
            <option value="before">Before a cutoff: +X points</option>
            <option value="multiplier_before">Before a cutoff: points ×M</option>
          </select>

          {bonusKind === "first_n" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bonus-n">First N teams</Label>
                <Input id="bonus-n" type="number" min={1} value={bonusN}
                  onChange={(e) => setBonusN(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bonus-pts">Bonus points</Label>
                <Input id="bonus-pts" type="number" min={1} value={bonusPoints}
                  onChange={(e) => setBonusPoints(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}
          {(bonusKind === "before" || bonusKind === "multiplier_before") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bonus-cutoff">Cutoff (SGT)</Label>
                <Input id="bonus-cutoff" type="datetime-local" value={bonusCutoff}
                  onChange={(e) => setBonusCutoff(e.target.value)} className={inputCls} />
              </div>
              {bonusKind === "before" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="bonus-pts2">Bonus points</Label>
                  <Input id="bonus-pts2" type="number" min={1} value={bonusPoints}
                    onChange={(e) => setBonusPoints(e.target.value)} className={inputCls} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="bonus-mult">Multiplier</Label>
                  <Input id="bonus-mult" type="number" step="0.1" min={1.1}
                    value={bonusMultiplier}
                    onChange={(e) => setBonusMultiplier(e.target.value)}
                    className={inputCls} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch id="published" checked={isPublished} onCheckedChange={setIsPublished} />
          <Label htmlFor="published">
            Published {isPublished ? "(visible from its release time)" : "(hidden draft)"}
          </Label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={pending} className="px-6 font-bold">
            {pending ? "Saving..." : task ? "Save changes" : "Create task"}
          </Button>
          {task && (
            <Button
              onClick={remove}
              disabled={pending}
              variant="outline"
              className="text-destructive hover:text-destructive"
            >
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
