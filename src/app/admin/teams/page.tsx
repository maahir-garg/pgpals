import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data";
import { TeamsToolbar } from "./teams-toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeaderboardRow, Profile, RosterEntry, Team } from "@/lib/types";

export const metadata: Metadata = { title: "Teams" };

export default async function AdminTeamsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: teamsData }, { data: rosterData }, { data: profilesData }, { data: boardData }] =
    await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase.from("roster").select("*"),
      supabase.from("profiles").select("*"),
      supabase.rpc("get_leaderboard"),
    ]);

  const teams = (teamsData ?? []) as Team[];
  const roster = (rosterData ?? []) as RosterEntry[];
  const profiles = (profilesData ?? []) as Profile[];
  const points = new Map(
    ((boardData ?? []) as LeaderboardRow[]).map((r) => [r.team_id, r.points])
  );
  const signedUp = new Set(profiles.map((p) => p.email));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">
          Teams <span className="text-base font-semibold text-muted-foreground">({teams.length})</span>
        </h1>
        <TeamsToolbar />
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => {
              const members = roster.filter((r) => r.team_id === team.id);
              return (
                <TableRow key={team.id}>
                  <TableCell>
                    <Link
                      href={`/admin/teams/${team.id}`}
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {team.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {members.length === 0 && (
                      <span className="text-muted-foreground">no members yet</span>
                    )}
                    {members.map((m) => (
                      <span key={m.id} className="mr-3 whitespace-nowrap">
                        {m.full_name}{" "}
                        <span title={signedUp.has(m.email) ? "Signed up" : "Not signed up yet"}>
                          {signedUp.has(m.email) ? "✅" : "⏳"}
                        </span>
                      </span>
                    ))}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {points.get(team.id) ?? 0}
                  </TableCell>
                </TableRow>
              );
            })}
            {teams.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  No teams yet. Import a CSV to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        ✅ signed up · ⏳ on the roster but hasn&apos;t created an account yet
      </p>
    </div>
  );
}
