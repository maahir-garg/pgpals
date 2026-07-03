import type { Metadata } from "next";
import { Lock, Trophy } from "lucide-react";
import { requireProfile, getEventSettings } from "@/lib/data";
import { formatSGT } from "@/lib/datetime";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/types";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const { supabase, profile } = await requireProfile();
  const settings = await getEventSettings(supabase);

  // Server-enforced: this RPC returns nothing to participants after the hide
  // date, no matter what the client asks for.
  const { data } = await supabase.rpc("get_leaderboard");
  const rows = (data ?? []) as LeaderboardRow[];

  const hidden =
    rows.length === 0 &&
    profile.role !== "admin" &&
    new Date(settings.leaderboard_hide_at).getTime() <= Date.now();

  if (hidden) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Leaderboard</h1>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="space-y-3 py-12 text-center">
            <Lock className="mx-auto size-10 text-primary" aria-hidden />
            <h2 className="text-xl font-extrabold">Leaderboard hidden!</h2>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">
              The final stretch is a mystery, so keep earning points! Final
              results will be revealed at the closing ceremony.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mine = rows.find((r) => r.is_mine);
  const top10 = rows.slice(0, 10);
  const rest = rows.slice(10);

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-16">
      <div className="flex items-end justify-between gap-3 border-b pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Team standings by approved points.
          </p>
        </div>
        <Trophy className="size-6 text-primary" aria-hidden />
      </div>
      {profile.role === "admin" &&
        new Date(settings.leaderboard_hide_at).getTime() <= Date.now() && (
          <p className="rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">
            Admin view. Participants see the hidden state since{" "}
            {formatSGT(settings.leaderboard_hide_at)}.
          </p>
        )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground">
            No points on the board yet. Get out there!
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y">
            {top10.map((row) => (
              <LeaderRow key={row.team_id} row={row} highlight />
            ))}
            {rest.map((row) => (
              <LeaderRow key={row.team_id} row={row} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Your rank, pinned above the bottom nav. Phone only: on desktop the
          whole list is visible and your row is already highlighted. */}
      {mine && (
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto w-full max-w-lg px-4 pb-2 md:hidden">
          <div className="flex items-center justify-between rounded-lg bg-foreground px-4 py-3 text-background shadow-lg">
            <span className="font-bold">
              Your team is #{mine.rank}
            </span>
            <span className="font-extrabold">{mine.points} pts</span>
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderRow({
  row,
  highlight = false,
}: {
  row: LeaderboardRow;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3",
        row.is_mine && "-mx-2 rounded-md bg-primary/10 px-2"
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-md text-sm font-extrabold",
          highlight && row.rank <= 3
            ? "bg-secondary text-secondary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {row.rank}
      </span>
      <span
        className={cn(
          "flex-1 truncate",
          highlight ? "font-bold" : "font-semibold text-sm",
          row.is_mine && "text-primary"
        )}
      >
        {row.team_name}
        {row.is_mine && " (you!)"}
      </span>
      <span className="font-extrabold">{row.points}</span>
    </div>
  );
}
