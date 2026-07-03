import Link from "next/link";
import type { Metadata } from "next";
import {
  Activity,
  ArrowRight,
  ClipboardCheck,
  Inbox,
  Megaphone,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { requireAdmin } from "@/lib/data";
import { formatSGT } from "@/lib/datetime";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Submission, Team } from "@/lib/types";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdmin();

  // Start of "today" in SGT, as a UTC instant.
  const now = new Date();
  const sgtNow = new Date(now.getTime() + 8 * 3600_000);
  const sgtMidnightUtc = new Date(
    Date.UTC(
      sgtNow.getUTCFullYear(),
      sgtNow.getUTCMonth(),
      sgtNow.getUTCDate()
    ) - 8 * 3600_000
  ).toISOString();

  const [
    { count: pendingCount },
    { count: todayCount },
    { count: teamCount },
    { data: submittingTeams },
    { data: tasks },
    { data: oldestPending },
    { data: teams },
  ] = await Promise.all([
    supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .gte("submitted_at", sgtMidnightUtc),
    supabase.from("teams").select("*", { count: "exact", head: true }),
    supabase.from("submissions").select("team_id"),
    supabase.from("tasks").select("id, title, is_published, release_at, deadline_at"),
    supabase
      .from("submissions")
      .select("*")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true })
      .limit(5),
    supabase.from("teams").select("id, name"),
  ]);

  const uniqueSubmitters = new Set((submittingTeams ?? []).map((s) => s.team_id))
    .size;
  const participation =
    teamCount && teamCount > 0
      ? Math.round((uniqueSubmitters / teamCount) * 100)
      : 0;
  const liveTasks = (tasks ?? []).filter(
    (t) =>
      t.is_published &&
      new Date(t.release_at) <= now &&
      new Date(t.deadline_at) > now
  ).length;

  const taskTitle = new Map((tasks ?? []).map((t) => [t.id, t.title]));
  const teamName = new Map(
    ((teams ?? []) as Pick<Team, "id" | "name">[]).map((t) => [t.id, t.name])
  );

  const stats: {
    label: string;
    value: string | number;
    icon: LucideIcon;
    href: string;
    accent?: boolean;
  }[] = [
    {
      label: "Pending review",
      value: pendingCount ?? 0,
      icon: ClipboardCheck,
      href: "/admin/review",
      accent: (pendingCount ?? 0) > 0,
    },
    { label: "Submissions today", value: todayCount ?? 0, icon: Inbox, href: "/admin/review" },
    {
      label: "Teams participating",
      value: `${participation}%`,
      icon: Users,
      href: "/admin/teams",
    },
    { label: "Tasks live now", value: liveTasks, icon: Target, href: "/admin/tasks" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-foreground p-5 text-background shadow-sm md:p-6">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-xs font-bold uppercase text-background/60">
              RA operations
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">
              Admin control room
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-background/70">
              Review queue health, live tasks, and team participation.
            </p>
          </div>
          <Button asChild variant="secondary" className="justify-between md:min-w-48">
            <Link href="/admin/review">
              Open review queue
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card
              className={
                "border-l-4 transition-colors hover:bg-card " +
                (stat.accent
                  ? "border-l-destructive bg-destructive/5"
                  : "border-l-primary bg-card")
              }
            >
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase text-muted-foreground">
                    {stat.label}
                  </span>
                  <stat.icon
                    className={
                      "size-4 " +
                      (stat.accent ? "text-destructive" : "text-primary")
                    }
                    aria-hidden
                  />
                </div>
                <div className="text-3xl font-extrabold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-extrabold">Review priority</p>
                <p className="text-sm text-muted-foreground">
                  Oldest pending submissions first.
                </p>
              </div>
              <Activity className="size-5 text-primary" aria-hidden />
            </div>
            {((oldestPending ?? []) as Submission[]).length > 0 ? (
              <div className="divide-y rounded-md border bg-background">
                {((oldestPending ?? []) as Submission[]).map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/review?task=${s.task_id}`}
                    className="grid gap-1 px-3 py-3 text-sm transition-colors hover:bg-primary/5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {(taskTitle.get(s.task_id) as string) ?? "Task"}
                      </span>
                      <span className="text-muted-foreground">
                        {teamName.get(s.team_id) ?? "Team"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                      {formatSGT(s.submitted_at)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-md border bg-background p-6 text-sm text-muted-foreground">
                No submissions waiting for review.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-2 text-sm">
              <p className="font-extrabold">Quick actions</p>
              {[
                { href: "/admin/tasks", label: "Manage tasks", icon: Target },
                { href: "/admin/announcements", label: "Post announcement", icon: Megaphone },
                { href: "/admin/teams", label: "Manage teams", icon: Users },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center justify-between rounded-md bg-muted px-3 py-2 font-semibold transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <span className="flex items-center gap-2">
                    <action.icon className="size-4" aria-hidden />
                    {action.label}
                  </span>
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="text-sm text-muted-foreground">
              <p className="font-extrabold text-foreground">Day-of checklist</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Clear the review queue so rejected teams have time to resubmit.</li>
                <li>Watch Supabase storage usage during photo-heavy tasks.</li>
                <li>Post an announcement when new tasks drop.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
