import type { Metadata } from "next";
import { requireProfile, getEventSettings } from "@/lib/data";
import { formatSGT } from "@/lib/datetime";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/types";

export const metadata: Metadata = { title: "Leaderboard" };

const MEDALS = ["🥇", "🥈", "🥉"];

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
        <h1 className="px-1 text-2xl font-extrabold">Leaderboard</h1>
        <Card className="rounded-3xl border-none bg-gradient-to-br from-chart-4/20 to-primary/20">
          <CardContent className="space-y-3 py-12 text-center">
            <div className="text-6xl">🤫</div>
            <h2 className="text-xl font-extrabold">Leaderboard hidden!</h2>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">
              The final stretch is a mystery, so keep earning points! Final
              results will be revealed at the closing ceremony. 🎊
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
    <div className="mx-auto max-w-2xl space-y-4 pb-16">
      <h1 className="px-1 text-2xl font-extrabold">Leaderboard</h1>
      {profile.role === "admin" &&
        new Date(settings.leaderboard_hide_at).getTime() <= Date.now() && (
          <p className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">
            👁️ Admin view. Participants see the hidden state since{" "}
            {formatSGT(settings.leaderboard_hide_at)}.
          </p>
        )}

      {rows.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="pt-5 text-center text-sm text-muted-foreground">
            No points on the board yet. Get out there! 🏃
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="divide-y pt-2">
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
          <div className="flex items-center justify-between rounded-2xl bg-foreground px-4 py-3 text-background shadow-lg">
            <span className="font-bold">
              {MEDALS[mine.rank - 1] ?? "📍"} Your team is #{mine.rank}
            </span>
            <span className="font-extrabold">⭐ {mine.points}</span>
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
        "flex items-center gap-3 py-2.5",
        row.is_mine && "-mx-2 rounded-xl bg-primary/10 px-2"
      )}
    >
      <span
        className={cn(
          "w-8 text-center font-extrabold",
          highlight ? "text-lg" : "text-sm text-muted-foreground"
        )}
      >
        {MEDALS[row.rank - 1] ?? row.rank}
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
