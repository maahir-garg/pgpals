import { createClient } from "@/lib/supabase/server";
import type { LeaderboardRow, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

function csvCell(value: string | number): string {
  let text = String(value);
  // Prevent spreadsheet apps from treating a team name as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .rpc("get_my_profile")
    .single<Profile>();

  if (!profile) {
    return new Response("Log in to export the leaderboard.", { status: 401 });
  }
  if (profile.role !== "admin") {
    return new Response("Only RAs can export the leaderboard.", { status: 403 });
  }

  const { data, error } = await supabase.rpc("get_leaderboard");
  if (error) {
    return new Response("Could not export the leaderboard.", { status: 500 });
  }

  const rows = (data ?? []) as LeaderboardRow[];
  const csv = [
    ["Rank", "Team", "PGP Coins"].map(csvCell).join(","),
    ...rows.map((row) =>
      [row.rank, row.team_name, row.points].map(csvCell).join(",")
    ),
  ].join("\r\n");
  const date = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Singapore",
  });

  return new Response(`\uFEFF${csv}\r\n`, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="pgpals-leaderboard-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
