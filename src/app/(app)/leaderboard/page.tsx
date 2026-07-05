import type { Metadata } from "next";
import { Gift, Lock, Trophy } from "lucide-react";
import { requireProfile, getEventSettings } from "@/lib/data";
import { formatSGT } from "@/lib/datetime";
import {
  PARTICIPATION_REWARD,
  PRIZE_CEREMONY_LABEL,
  PRIZE_REVEAL_TEASER,
  PRIZE_TIERS,
  PRIZE_WINNER_COUNT,
} from "@/lib/prizes";
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
        <Card>
          <CardContent className="space-y-4 py-12 text-center">
            <span className="mx-auto grid size-16 rotate-[-3deg] place-items-center rounded-2xl border-2 border-foreground bg-accent shadow-pop">
              <Lock className="size-7 text-accent-foreground" strokeWidth={2.5} aria-hidden />
            </span>
            <h2 className="text-xl font-extrabold">The board has gone dark!</h2>
            <p className="mx-auto max-w-xs text-sm leading-6 text-muted-foreground">
              The final stretch is a mystery. Keep banking coins: the top{" "}
              {PRIZE_WINNER_COUNT} teams are crowned live at the prize ceremony
              on {PRIZE_CEREMONY_LABEL}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mine = rows.find((r) => r.is_mine);
  const prizeRows = rows.slice(0, PRIZE_WINNER_COUNT);
  const rest = rows.slice(PRIZE_WINNER_COUNT);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-end justify-between gap-3 border-b-2 border-dashed border-foreground/25 pb-6">
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

      <div className="rounded-xl border-2 border-foreground bg-secondary/25 px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-foreground bg-secondary text-secondary-foreground">
            <Gift className="size-4" strokeWidth={2.5} aria-hidden />
          </span>
          <p className="text-sm font-semibold">
            Top {PRIZE_WINNER_COUNT} teams win from a tech prize pool at the
            ceremony on {PRIZE_CEREMONY_LABEL}. The board hides before the
            finale, so keep pushing!
          </p>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {PRIZE_REVEAL_TEASER}
        </p>
        <ul className="mt-4 space-y-2 border-t-2 border-dashed border-foreground/20 pt-4">
          {PRIZE_TIERS.map((tier) => (
            <li key={tier.place} className="text-sm font-semibold">
              {tier.place} place: {tier.prize}
            </li>
          ))}
          <li className="text-sm font-semibold">
            Participation: {PARTICIPATION_REWARD.prize}
          </li>
        </ul>
      </div>

      {profile.role === "admin" &&
        new Date(settings.leaderboard_hide_at).getTime() <= Date.now() && (
          <p className="rounded-lg border-2 border-foreground bg-accent/40 px-3 py-2 text-xs font-bold">
            Admin view. Participants see the hidden state since{" "}
            {formatSGT(settings.leaderboard_hide_at)}.
          </p>
        )}

      {mine && (
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-foreground bg-primary px-4 py-3 text-sm text-primary-foreground shadow-pop md:hidden">
          <span className="font-bold">Your team is #{mine.rank}</span>
          <span className="shrink-0 font-heading font-extrabold">
            {mine.points} coins
          </span>
        </div>
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
            {prizeRows.map((row) => (
              <LeaderRow key={row.team_id} row={row} highlight />
            ))}
            {rest.map((row) => (
              <LeaderRow key={row.team_id} row={row} />
            ))}
          </CardContent>
        </Card>
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
