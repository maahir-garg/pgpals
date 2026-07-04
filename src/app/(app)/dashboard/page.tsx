import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock3,
  Coins,
  ListChecks,
  Pin,
  Shield,
  Trophy,
} from "lucide-react";
import { requireProfile, getEventSettings, getMyScore } from "@/lib/data";
import { taskStatusMap, isClosed } from "@/lib/status";
import { formatSGT } from "@/lib/datetime";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountdownBadge, PointsBadge } from "@/components/pgpals/badges";
import { Markdown } from "@/components/pgpals/markdown";
import { TeamNameEditor } from "@/components/pgpals/team-name-editor";
import type {
  Announcement,
  BonusAward,
  EventSettings,
  Profile,
  RosterEntry,
  Task,
  Team,
} from "@/lib/types";

type DashboardTask = Pick<
  Task,
  "id" | "title" | "points" | "deadline_at"
>;
type DashboardSubmission = Pick<
  import("@/lib/types").Submission,
  "id" | "task_id" | "status" | "points_awarded" | "submitted_at" | "reviewed_at"
>;
type DashboardTeammate = Pick<Profile, "full_name" | "team_id">;
type DashboardRosterEntry = Pick<RosterEntry, "email" | "full_name">;
type DashboardBonus = Pick<
  BonusAward,
  "id" | "points" | "reason" | "created_at"
>;

export const metadata: Metadata = { title: "Home" };

function AnnouncementsFeed({
  announcements,
}: {
  announcements: Announcement[];
}) {
  return (
    <section className="min-w-0 space-y-3">
      <h2 className="text-lg font-bold">Announcements</h2>
      {announcements.length === 0 && (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            Nothing posted yet.
          </CardContent>
        </Card>
      )}
      {announcements.map((a) => (
        <Card key={a.id}>
          <CardContent>
            <div className="grid gap-1 sm:flex sm:items-start sm:justify-between sm:gap-3">
              <h3 className="flex min-w-0 items-center gap-1.5 font-bold">
                {a.pinned && (
                  <Pin
                    className="size-3.5 shrink-0 fill-current text-primary"
                    aria-label="Pinned"
                  />
                )}
                <span className="min-w-0 break-words">{a.title}</span>
              </h3>
              <span className="text-xs text-muted-foreground sm:shrink-0">
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
  );
}

function EventDatesCard({ settings }: { settings: EventSettings }) {
  return (
    <Card className="border-border shadow-none">
      <CardContent className="flex gap-3 text-sm text-muted-foreground">
        <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          {settings.event_name} runs{" "}
          {formatSGT(settings.start_at, { hour: undefined, minute: undefined })}{" "}
          to{" "}
          {formatSGT(settings.end_at, { hour: undefined, minute: undefined })}.
          All times SGT.
        </p>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile();

  // No team: nothing team-scoped (coins, to-dos, history) applies. RAs land
  // here too when they aren't playing on a team - point them to the console.
  if (!profile.team_id) {
    const [{ data: announcements }, settings] = await Promise.all([
      supabase
        .from("announcements")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10),
      getEventSettings(supabase),
    ]);
    const isAdmin = profile.role === "admin";
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-xl border-2 border-foreground bg-card p-6 shadow-sticker">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Hey, {profile.full_name.split(" ")[0]}!
          </h1>
          {isAdmin ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;re running the show, not playing. Reviews, tasks, and
                teams all live in the admin console.
              </p>
              <Button asChild className="mt-4">
                <Link href="/admin">
                  <Shield className="size-4" aria-hidden />
                  Open admin console
                </Link>
              </Button>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;re not on a team yet, so tasks and coins are locked for
              now. Ask your RA to add you to the roster and you&apos;ll be in
              the game in a minute.
            </p>
          )}
        </section>
        <AnnouncementsFeed
          announcements={(announcements ?? []) as Announcement[]}
        />
        <EventDatesCard settings={settings} />
      </div>
    );
  }

  const [
    { data: team },
    { data: teammates },
    { data: roster },
    { data: announcements },
    { data: tasks },
    { data: submissions },
    { data: bonuses },
    score,
    settings,
  ] = await Promise.all([
    supabase.from("teams").select("id, name").eq("id", profile.team_id).single<Pick<Team, "id" | "name">>(),
    supabase.from("profiles").select("full_name, team_id").neq("id", profile.id),
    supabase.from("roster").select("email, full_name"),
    supabase
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("tasks").select("id, title, points, deadline_at"),
    supabase
      .from("submissions")
      .select("id, task_id, status, points_awarded, submitted_at, reviewed_at"),
    supabase
      .from("bonus_awards")
      .select("id, points, reason, created_at")
      .order("created_at", { ascending: false }),
    getMyScore(supabase),
    getEventSettings(supabase),
  ]);

  const allTasks = (tasks ?? []) as DashboardTask[];
  const allSubs = (submissions ?? []) as DashboardSubmission[];
  const statusByTask = taskStatusMap(allSubs);

  // Partner: signed-up teammate, else roster entry who hasn't joined yet.
  const teammate = ((teammates ?? []) as DashboardTeammate[]).find(
    (p) => p.team_id === profile.team_id
  );
  const rosterPartner = ((roster ?? []) as DashboardRosterEntry[]).find(
    (r) => r.email !== profile.email
  );

  // The home screen is a to-do list: fix rejections first, then open tasks
  // by deadline, then whatever is waiting on the RAs.
  const actionNeeded = allTasks.filter(
    (t) =>
      !isClosed(t.deadline_at) && statusByTask.get(t.id) === "rejected"
  );
  const todo = allTasks
    .filter(
      (t) => !isClosed(t.deadline_at) && !statusByTask.has(t.id)
    )
    .sort((a, b) => a.deadline_at.localeCompare(b.deadline_at));
  const inReview = allTasks.filter(
    (t) => statusByTask.get(t.id) === "pending"
  );

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
    ...((bonuses ?? []) as DashboardBonus[]).map((b) => ({
      key: `b-${b.id}`,
      when: b.created_at,
      label: `Bonus: ${b.reason}`,
      points: b.points,
    })),
  ].sort((a, b) => b.when.localeCompare(a.when));
  const recentHistory = history.slice(0, 5);
  const olderHistory = history.slice(5);

  const approvedCount = allSubs.filter((s) => s.status === "approved").length;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border-2 border-foreground bg-card p-6 shadow-sticker">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">
              Team dashboard
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="min-w-0 text-2xl font-extrabold tracking-tight md:text-3xl">
                {team?.name}
              </h1>
              <TeamNameEditor currentName={team?.name ?? ""} />
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

          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
            <div
              className="rounded-lg border-2 border-foreground bg-accent p-3 shadow-pop-sm"
              title="PGP Coins"
            >
              <Coins className="mx-auto size-4 text-accent-foreground" strokeWidth={2.5} aria-hidden />
              <div className="mt-1 font-heading text-2xl font-extrabold text-accent-foreground">
                {score ?? 0}
              </div>
              <div className="text-xs font-bold text-accent-foreground/80">
                PGP Coins
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <ListChecks className="mx-auto size-4 text-muted-foreground" aria-hidden />
              <div className="mt-1 font-heading text-2xl font-extrabold">
                {approvedCount}
              </div>
              <div className="text-xs font-semibold text-muted-foreground">
                approved
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <Clock3 className="mx-auto size-4 text-muted-foreground" aria-hidden />
              <div className="mt-1 font-heading text-2xl font-extrabold">
                {todo.length + actionNeeded.length}
              </div>
              <div className="text-xs font-semibold text-muted-foreground">
                to do
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-6">
          {actionNeeded.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4.5 text-destructive" aria-hidden />
                <h2 className="text-lg font-bold text-destructive">
                  Needs a fix
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {actionNeeded.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tasks/${t.id}`}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4 text-sm font-semibold transition-colors hover:bg-destructive/10"
                  >
                    <span className="min-w-0 leading-snug">{t.title}</span>
                    <ArrowRight className="size-4 shrink-0" aria-hidden />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Up next</h2>
              <Link
                href="/tasks"
                className="shrink-0 text-sm font-semibold text-primary hover:underline"
              >
                All tasks
              </Link>
            </div>
            {todo.length === 0 ? (
              <Card>
                <CardContent className="text-sm text-muted-foreground">
                  {allTasks.length === 0
                    ? "No tasks released yet. The fun starts soon."
                    : "All caught up! Check back when new tasks drop."}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {todo.slice(0, 6).map((t) => (
                  <Link
                    key={t.id}
                    href={`/tasks/${t.id}`}
                    className="grid min-w-0 gap-2 rounded-lg border-2 border-border bg-card px-4 py-3 transition-bouncy hover:border-foreground hover:shadow-pop-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3"
                  >
                    <span className="min-w-0 text-sm font-semibold leading-snug">
                      {t.title}
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5 sm:justify-end">
                      <CountdownBadge deadline={t.deadline_at} />
                      <PointsBadge points={t.points} />
                    </span>
                  </Link>
                ))}
                {todo.length > 6 && (
                  <Link
                    href="/tasks"
                    className="block rounded-lg border-2 border-dashed px-4 py-2 text-center text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
                  >
                    {todo.length - 6} more open {todo.length - 6 === 1 ? "task" : "tasks"}
                  </Link>
                )}
              </div>
            )}
          </section>

          {inReview.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold">Waiting on the RAs</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {inReview.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tasks/${t.id}`}
                    className="grid min-w-0 gap-2 rounded-lg border-2 border-border bg-card px-4 py-3 text-sm font-semibold transition-bouncy hover:border-foreground hover:shadow-pop-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3"
                  >
                    <span className="min-w-0 leading-snug">{t.title}</span>
                    <Badge className="w-fit bg-warning/15 text-warning hover:bg-warning/15 sm:justify-self-end">
                      In review
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <AnnouncementsFeed
            announcements={(announcements ?? []) as Announcement[]}
          />
        </div>

        <aside className="min-w-0 space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold">Leaderboard</h2>
                  <p className="text-sm text-muted-foreground">
                    Top teams win prizes at the closing ceremony.
                  </p>
                </div>
                <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-foreground bg-accent text-accent-foreground">
                  <Trophy className="size-5" strokeWidth={2.5} aria-hidden />
                </span>
              </div>
              <Link
                href="/leaderboard"
                className="flex items-center justify-between rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Open leaderboard
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardContent className="space-y-2">
                <h2 className="font-bold">Coin history</h2>
                <div className="divide-y">
                  {recentHistory.map((h) => (
                    <HistoryRow key={h.key} item={h} />
                  ))}
                </div>
                {olderHistory.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer list-none rounded-lg border-2 border-dashed px-3 py-2 text-center text-sm font-semibold text-muted-foreground transition-colors hover:text-primary group-open:hidden">
                      Show all ({history.length})
                    </summary>
                    <div className="divide-y">
                      {olderHistory.map((h) => (
                        <HistoryRow key={h.key} item={h} />
                      ))}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          )}

          <EventDatesCard settings={settings} />
        </aside>
      </div>
    </div>
  );
}

function HistoryRow({
  item,
}: {
  item: { when: string; label: string; points: number };
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 text-sm">
      <div className="min-w-0">
        <div className="truncate font-semibold">{item.label}</div>
        <div className="text-xs text-muted-foreground">
          {formatSGT(item.when)}
        </div>
      </div>
      <span
        className={
          "shrink-0 font-bold " +
          (item.points < 0 ? "text-destructive" : "text-success")
        }
      >
        {item.points < 0 ? item.points : `+${item.points}`}
      </span>
    </div>
  );
}
