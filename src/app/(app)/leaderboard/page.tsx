import type { Metadata } from "next";
import { Gift, Lock, Trophy } from "lucide-react";
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
  const prizeLines = (settings.prizes ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const hidden =
    rows.length === 0 &&
    profile.role !== "admin" &&
    new Date(settings.leaderboard_hide_at).getTime() <= Date.now();

  if (hidden) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Leaderboard</h1>
        <Card>
          <CardContent className="space-y-4 py-12 text-center">
            <span className="mx-auto grid size-16 rotate-[-3deg] place-items-center rounded-2xl border-2 border-foreground bg-accent shadow-pop">
              <Lock className="size-7 text-accent-foreground" strokeWidth={2.5} aria-hidden />
            </span>
            <h2 className="text-xl font-extrabold">The board has gone dark!</h2>
            <p className="mx-auto max-w-xs text-sm leading-6 text-muted-foreground">
              The final stretch is a mystery. Keep banking coins — the
              winning teams and their prizes are revealed live at the closing
              ceremony.
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
      <div className="flex items-end justify-between gap-3 border-b-2 border-dashed border-foreground/25 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Team standings by PGP Coins earned.
          </p>
        </div>
        <span className="grid size-11 shrink-0 rotate-3 place-items-center rounded-xl border-2 border-foreground bg-accent shadow-pop-sm">
          <Trophy className="size-5 text-accent-foreground" strokeWidth={2.5} aria-hidden />
        </span>
      </div>

      <div className="rounded-xl border-2 border-foreground bg-secondary/25 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-foreground bg-secondary text-secondary-foreground">
            <Gift className="size-4" strokeWidth={2.5} aria-hidden />
          </span>
          <p className="text-sm font-semibold">
            Top teams win prizes at the closing ceremony. The board hides
            before the finale, so keep pushing!
          </p>
        </div>
        {prizeLines.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t-2 border-dashed border-foreground/20 pt-3">
            {prizeLines.map((line) => (
              <li key={line} className="text-sm font-semibold">
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>

      {profile.role === "admin" &&
        new Date(settings.leaderboard_hide_at).getTime() <= Date.now() && (
          <p className="rounded-lg border-2 border-foreground bg-accent/40 px-3 py-2 text-xs font-bold">
            Admin view. Participants see the hidden state since{" "}
            {formatSGT(settings.leaderboard_hide_at)}.
          </p>
        )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground">
            No coins on the board yet. Get out there!
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y-2 divide-dashed divide-border">
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
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto w-full max-w-lg px-4 pb-3 md:hidden">
          <div className="flex items-center justify-between rounded-xl border-2 border-foreground bg-primary px-4 py-3 text-primary-foreground shadow-pop">
            <span className="font-bold">Your team is #{mine.rank}</span>
            <span className="font-heading font-extrabold">{mine.points} coins</span>
          </div>
        </div>
      )}
    </div>
  );
}

const MEDALS = ["bg-accent", "bg-secondary", "bg-mint"];

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
        row.is_mine && "-mx-2 rounded-lg bg-primary/10 px-2"
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold",
          highlight && row.rank <= 3
            ? `border-2 border-foreground text-foreground ${MEDALS[row.rank - 1]}`
            : "bg-muted text-muted-foreground"
        )}
      >
        {row.rank}
      </span>
      <span
        className={cn(
          "flex-1 truncate",
          highlight ? "font-bold" : "text-sm font-semibold",
          row.is_mine && "text-primary"
        )}
      >
        {row.team_name}
        {row.is_mine && " (you!)"}
      </span>
      <span className="font-heading font-extrabold">{row.points}</span>
    </div>
  );
}
