import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data";
import { formatSGT } from "@/lib/datetime";
import { StatusBadge } from "@/components/pgpals/badges";
import { Card, CardContent } from "@/components/ui/card";
import { TeamAdminPanel } from "./team-admin-panel";
import type {
  BonusAward,
  Profile,
  RosterEntry,
  Submission,
  Task,
  Team,
} from "@/lib/types";

export const metadata: Metadata = { title: "Team" };

export default async function AdminTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("id", id)
    .maybeSingle<Team>();
  if (!team) notFound();

  const [
    { data: rosterData },
    { data: profilesData },
    { data: subsData },
    { data: tasksData },
    { data: bonusData },
  ] = await Promise.all([
    supabase.from("roster").select("*").eq("team_id", id),
    supabase.from("profiles").select("*").eq("team_id", id),
    supabase
      .from("submissions")
      .select("*")
      .eq("team_id", id)
      .order("submitted_at", { ascending: false }),
    supabase.from("tasks").select("id, title"),
    supabase
      .from("bonus_awards")
      .select("*")
      .eq("team_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const roster = (rosterData ?? []) as RosterEntry[];
  const profiles = (profilesData ?? []) as Profile[];
  const submissions = (subsData ?? []) as Submission[];
  const bonuses = (bonusData ?? []) as BonusAward[];
  const taskTitle = new Map(
    ((tasksData ?? []) as Pick<Task, "id" | "title">[]).map((t) => [t.id, t.title])
  );
  const signedUpEmails = new Set(profiles.map((p) => p.email));

  return (
    <div className="space-y-5">
      <Link href="/admin/teams" className="text-sm font-semibold text-muted-foreground">
        ← All teams
      </Link>

      <TeamAdminPanel
        team={team}
        roster={roster.map((r) => ({
          ...r,
          signedUp: signedUpEmails.has(r.email),
        }))}
      />

      <section className="space-y-2">
        <h2 className="font-bold">🧾 Bonus points</h2>
        {bonuses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No manual bonuses yet.</p>
        ) : (
          <Card className="rounded-2xl">
            <CardContent className="divide-y pt-2">
              {bonuses.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-semibold">{b.reason}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatSGT(b.created_at)}
                    </div>
                  </div>
                  <span className="font-bold text-primary">
                    {b.points > 0 ? "+" : ""}
                    {b.points}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">📜 Submission history</h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
        ) : (
          <Card className="rounded-2xl">
            <CardContent className="divide-y pt-2">
              {submissions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {taskTitle.get(s.task_id) ?? "(task)"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatSGT(s.submitted_at)}
                      {s.status === "approved" && s.points_awarded != null
                        ? ` · +${s.points_awarded} pts`
                        : ""}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
