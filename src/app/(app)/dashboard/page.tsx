import Link from "next/link";
import type { Metadata } from "next";
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

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-4 lg:col-span-2">
      {/* Team hero card */}
      <Card className="overflow-hidden rounded-3xl border-none bg-gradient-to-br from-primary to-chart-4 text-primary-foreground shadow-lg">
        <CardContent className="pt-6">
          {team ? (
            <>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-extrabold">{team.name}</h2>
                <span className="[&_button]:text-primary-foreground/90">
                  <TeamNameEditor currentName={team.name} />
                </span>
              </div>
              <p className="mt-0.5 text-sm text-primary-foreground/85">
                {profile.full_name}
                {teammate
                  ? ` & ${teammate.full_name}`
                  : rosterPartner
                    ? ` & ${rosterPartner.full_name} (not signed up yet 👀)`
                    : ""}
              </p>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-4xl font-extrabold">⭐ {score ?? 0}</div>
                  <div className="text-sm text-primary-foreground/85">
                    points so far
                  </div>
                </div>
                <Link
                  href="/leaderboard"
                  className="rounded-full bg-primary-foreground/20 px-4 py-2 text-sm font-bold backdrop-blur transition-colors hover:bg-primary-foreground/30"
                >
                  Leaderboard →
                </Link>
              </div>
            </>
          ) : (
            <p className="font-semibold">
              You&apos;re not on a team yet. Ask your RA to add you! 🙋
            </p>
          )}
        </CardContent>
      </Card>

      {/* Action needed */}
      {actionNeeded.length > 0 && (
        <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
          <CardContent className="space-y-2 pt-5">
            <h3 className="font-bold text-destructive">❗ Action needed</h3>
            {actionNeeded.map((t) => (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className="block rounded-xl bg-card px-3 py-2 text-sm font-semibold shadow-sm"
              >
                {t.title}: rejected, fix &amp; resubmit →
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Waiting on review */}
      {inReview.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-2 pt-5">
            <h3 className="font-bold">🕐 In review</h3>
            {inReview.map((t) => (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm font-semibold"
              >
                <span>{t.title}</span>
                <span className="text-xs font-semibold text-muted-foreground">
                  RAs are on it
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* New tasks */}
      {newTasks.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-2 pt-5">
            <h3 className="font-bold">✨ New tasks</h3>
            {newTasks.map((t) => (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm font-semibold"
              >
                <span>{t.title}</span>
                <Badge className="rounded-full bg-secondary text-secondary-foreground">
                  ⭐ {t.points}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Announcements */}
      <div className="space-y-2">
        <h3 className="px-1 font-bold">📣 Announcements</h3>
        {(announcements ?? []).length === 0 && (
          <Card className="rounded-2xl">
            <CardContent className="pt-5 text-sm text-muted-foreground">
              Nothing yet. Check back soon!
            </CardContent>
          </Card>
        )}
        {((announcements ?? []) as Announcement[]).map((a) => (
          <Card key={a.id} className="rounded-2xl">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold">
                  {a.pinned && "📌 "}
                  {a.title}
                </h4>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatSGT(a.created_at)}
                </span>
              </div>
              <div className="mt-1 text-muted-foreground">
                <Markdown>{a.body}</Markdown>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </div>

      <div className="space-y-4">
        {/* Points history */}
        {history.length > 0 && (
          <div className="space-y-2">
            <h3 className="px-1 font-bold">🧾 Points history</h3>
            <Card className="rounded-2xl">
              <CardContent className="divide-y pt-2">
                {history.map((h) => (
                  <div
                    key={h.key}
                    className="flex items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div>
                      <div className="font-semibold">{h.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatSGT(h.when)}
                      </div>
                    </div>
                    <span className="font-bold text-primary">
                      {h.points < 0 ? h.points : `+${h.points}`}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        <p className="pb-2 text-center text-xs text-muted-foreground">
          {settings.event_name} runs{" "}
          {formatSGT(settings.start_at, { hour: undefined, minute: undefined })} to{" "}
          {formatSGT(settings.end_at, { hour: undefined, minute: undefined })} · all times SGT
        </p>
      </div>
    </div>
  );
}
