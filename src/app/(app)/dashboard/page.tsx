import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock3,
  ListChecks,
  Pin,
  Star,
  Trophy,
} from "lucide-react";
import { requireProfile, getEventSettings } from "@/lib/data";
import { taskStatusFor, isClosed } from "@/lib/status";
import { formatSGT } from "@/lib/datetime";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/pgpals/markdown";
import { TeamNameEditor } from "@/components/pgpals/team-name-editor";
import type {
  Announcement,
  BonusAward,
  Profile,
  RosterEntry,
  Submission,
  Task,
  Team,
} from "@/lib/types";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile();

  const [
    { data: team },
    { data: teammates },
    { data: roster },
    { data: announcements },
    { data: tasks },
    { data: submissions },
    { data: bonuses },
    { data: score },
    settings,
  ] = await Promise.all([
    profile.team_id
      ? supabase.from("teams").select("*").eq("id", profile.team_id).single<Team>()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("*").neq("id", profile.id),
    supabase.from("roster").select("*"),
    supabase
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("tasks").select("*"),
    supabase.from("submissions").select("*"),
    supabase.from("bonus_awards").select("*").order("created_at", { ascending: false }),
    supabase.rpc("get_my_score"),
    getEventSettings(await Promise.resolve(supabase)),
  ]);

  const allTasks = (tasks ?? []) as Task[];
  const allSubs = (submissions ?? []) as Submission[];

  // Partner: signed-up teammate, else roster entry who hasn't joined yet.
  const teammate = (teammates ?? []).find(
    (p: Profile) => p.team_id === profile.team_id
  );
  const rosterPartner = (roster ?? []).find(
    (r: RosterEntry) => r.email !== profile.email
  );

  const actionNeeded = allTasks.filter(
    (t) =>
      !isClosed(t.deadline_at) && taskStatusFor(t.id, allSubs) === "rejected"
  );
  const inReview = allTasks.filter(
    (t) => taskStatusFor(t.id, allSubs) === "pending"
  );
  const newTasks = allTasks
    .filter(
      (t) =>
        !isClosed(t.deadline_at) &&
        taskStatusFor(t.id, allSubs) === null &&
        Date.now() - new Date(t.release_at).getTime() < 48 * 60 * 60 * 1000
    )
    .sort((a, b) => b.release_at.localeCompare(a.release_at));

  const taskTitle = new Map(allTasks.map((t) => [t.id, t.title]));
  const history: { key: string; when: string; label: string; points: number }[] = [
    ...allSubs
      .filter((s) => s.status === "approved" && s.points_awarded != null)
      .map((s) => ({
        key: `s-${s.id}`,
        when: s.reviewed_at ?? s.submitted_at,
        label: taskTitle.get(s.task_id) ?? "Task",
        points: s.points_awarded!,
      })),
    ...(bonuses ?? []).map((b: BonusAward) => ({
      key: `b-${b.id}`,
      when: b.created_at,
      label: `Bonus: ${b.reason}`,
      points: b.points,
    })),
  ].sort((a, b) => b.when.localeCompare(a.when));

  const openTasks = allTasks.filter((t) => !isClosed(t.deadline_at)).length;
  const approvedCount = allSubs.filter((s) => s.status === "approved").length;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-5 shadow-sm md:p-6">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          {team ? (
            <div>
              <p className="text-sm font-semibold text-muted-foreground">
                Team dashboard
              </p>
              <div className="mt-1 flex items-center gap-2">
                <h1 className="min-w-0 text-2xl font-extrabold tracking-tight md:text-3xl">
                  {team.name}
                </h1>
                <TeamNameEditor currentName={team.name} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile.full_name}
                {teammate
                  ? ` & ${teammate.full_name}`
                  : rosterPartner
                    ? ` & ${rosterPartner.full_name} (not signed up yet)`
                    : ""}
              </p>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                Team not assigned
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask your RA to add you before the event starts.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
            <div className="rounded-md bg-primary/10 p-3">
              <Trophy className="mx-auto size-4 text-primary" aria-hidden />
              <div className="mt-1 text-2xl font-extrabold">{score ?? 0}</div>
              <div className="text-xs font-semibold text-muted-foreground">
                points
              </div>
            </div>
            <div className="rounded-md bg-muted p-3">
              <ListChecks className="mx-auto size-4 text-muted-foreground" aria-hidden />
              <div className="mt-1 text-2xl font-extrabold">{approvedCount}</div>
              <div className="text-xs font-semibold text-muted-foreground">
                approved
              </div>
            </div>
            <div className="rounded-md bg-muted p-3">
              <Clock3 className="mx-auto size-4 text-muted-foreground" aria-hidden />
              <div className="mt-1 text-2xl font-extrabold">{openTasks}</div>
              <div className="text-xs font-semibold text-muted-foreground">
                open
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-6">
          {actionNeeded.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-destructive" aria-hidden />
                <h2 className="text-lg font-extrabold text-destructive">
                  Needs your attention
                </h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {actionNeeded.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tasks/${t.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold transition-colors hover:bg-destructive/10"
                  >
                    <span>{t.title}</span>
                    <ArrowRight className="size-4 shrink-0" aria-hidden />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {(newTasks.length > 0 || inReview.length > 0) && (
            <section className="grid gap-3 md:grid-cols-2">
              {newTasks.length > 0 && (
                <Card>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-extrabold">New tasks</h2>
                      <Badge variant="outline">{newTasks.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {newTasks.map((t) => (
                        <Link
                          key={t.id}
                          href={`/tasks/${t.id}`}
                          className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm font-semibold transition-colors hover:bg-primary/10 hover:text-primary"
                        >
                          <span className="min-w-0 truncate">{t.title}</span>
                          <Badge className="bg-secondary text-secondary-foreground">
                            <Star className="size-3 fill-current" aria-hidden />
                            {t.points}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {inReview.length > 0 && (
                <Card>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-extrabold">In review</h2>
                      <Badge variant="outline">{inReview.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {inReview.map((t) => (
                        <Link
                          key={t.id}
                          href={`/tasks/${t.id}`}
                          className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm font-semibold transition-colors hover:bg-primary/10 hover:text-primary"
                        >
                          <span className="min-w-0 truncate">{t.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            pending
                          </span>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-extrabold">Announcements</h2>
            {(announcements ?? []).length === 0 && (
              <Card>
                <CardContent className="text-sm text-muted-foreground">
                  Nothing posted yet.
                </CardContent>
              </Card>
            )}
            {((announcements ?? []) as Announcement[]).map((a) => (
              <Card key={a.id}>
                <CardContent>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="flex min-w-0 items-center gap-1.5 font-bold">
                      {a.pinned && (
                        <Pin
                          className="size-3.5 shrink-0 fill-current text-primary"
                          aria-label="Pinned"
                        />
                      )}
                      <span>{a.title}</span>
                    </h3>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatSGT(a.created_at)}
                    </span>
                  </div>
                  <div className="mt-2 text-muted-foreground">
                    <Markdown>{a.body}</Markdown>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-extrabold">Leaderboard</h2>
                  <p className="text-sm text-muted-foreground">
                    See where your team stands.
                  </p>
                </div>
                <Trophy className="size-5 text-primary" aria-hidden />
              </div>
              <Link
                href="/leaderboard"
                className="flex items-center justify-between rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Open leaderboard
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardContent className="space-y-3">
                <h2 className="font-extrabold">Points history</h2>
                <div className="divide-y">
                  {history.map((h) => (
                    <div
                      key={h.key}
                      className="flex items-center justify-between gap-2 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{h.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatSGT(h.when)}
                        </div>
                      </div>
                      <span className="shrink-0 font-bold text-primary">
                        {h.points < 0 ? h.points : `+${h.points}`}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/50">
            <CardContent className="flex gap-3 text-sm text-muted-foreground">
              <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                {settings.event_name} runs{" "}
                {formatSGT(settings.start_at, {
                  hour: undefined,
                  minute: undefined,
                })}{" "}
                to{" "}
                {formatSGT(settings.end_at, {
                  hour: undefined,
                  minute: undefined,
                })}
                . All times SGT.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
