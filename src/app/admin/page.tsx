import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data";
import { Card, CardContent } from "@/components/ui/card";

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

  const stats = [
    {
      label: "Pending review",
      value: pendingCount ?? 0,
      emoji: "🔍",
      href: "/admin/review",
      accent: (pendingCount ?? 0) > 0,
    },
    { label: "Submissions today", value: todayCount ?? 0, emoji: "📥", href: "/admin/review" },
    {
      label: "Teams participating",
      value: `${participation}%`,
      emoji: "👥",
      href: "/admin/teams",
    },
    { label: "Tasks live now", value: liveTasks, emoji: "🎯", href: "/admin/tasks" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Overview</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card
              className={
                "rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-md " +
                (stat.accent ? "border-primary/40 bg-primary/5" : "")
              }
            >
              <CardContent className="pt-5">
                <div className="text-2xl">{stat.emoji}</div>
                <div className="mt-1 text-3xl font-extrabold">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="rounded-2xl">
        <CardContent className="pt-5 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Day-of checklist 📋</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Clear the review queue a few times a day so rejected teams have time to resubmit.</li>
            <li>Watch Supabase storage usage during photo-heavy tasks (README → runbook).</li>
            <li>Post an announcement when new tasks drop.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
