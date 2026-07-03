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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {teams.length} teams on the roster.
          </p>
        </div>
        <TeamsToolbar />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
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
                        <span
                          className={
                            signedUp.has(m.email)
                              ? "rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary"
                              : "rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground"
                          }
                          title={signedUp.has(m.email) ? "Signed up" : "Not signed up yet"}
                        >
                          {signedUp.has(m.email) ? "Signed" : "Roster"}
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
        Signed means the resident has created an account. Roster means they have
        not signed up yet.
      </p>
    </div>
  );
}
