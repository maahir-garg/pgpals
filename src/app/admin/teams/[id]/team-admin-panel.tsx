"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addRosterMember,
  deleteTeam,
  grantBonus,
  removeRosterMember,
  renameTeamAdmin,
} from "../../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RosterEntry, Team } from "@/lib/types";

type RosterWithStatus = RosterEntry & { signedUp: boolean };

export function TeamAdminPanel({
  team,
  roster,
}: {
  team: Team;
  roster: RosterWithStatus[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(team.name);
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [bonusPoints, setBonusPoints] = useState("5");
  const [bonusReason, setBonusReason] = useState("");

  function run(
    fn: () => Promise<{ ok: boolean; message?: string; error?: string }>,
    after?: () => void
  ) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Done.");
        after?.();
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl">
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Team name</Label>
            <div className="flex gap-2">
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 rounded-xl"
              />
              <Button
                disabled={pending || name.trim() === team.name}
                onClick={() => run(() => renameTeamAdmin(team.id, name))}
                className="rounded-xl"
              >
                Rename
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Members</Label>
            {roster.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-semibold">{m.full_name}</span>{" "}
                  <span title={m.signedUp ? "Signed up" : "Not signed up yet"}>
                    {m.signedUp ? "✅" : "⏳"}
                  </span>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Remove ${m.full_name} from this team's roster?`))
                      run(() => removeRosterMember(m.id));
                  }}
                  className="rounded-lg text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Input
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Full name"
                className="h-9 flex-1 rounded-xl"
              />
              <Input
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="email@u.nus.edu"
                className="h-9 flex-1 rounded-xl"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      addRosterMember({
                        teamId: team.id,
                        fullName: memberName,
                        email: memberEmail,
                      }),
                    () => {
                      setMemberName("");
                      setMemberEmail("");
                    }
                  )
                }
                className="h-9 rounded-xl"
              >
                Add
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (
                confirm(
                  `Delete team "${team.name}"? Their submissions and points will be gone. This cannot be undone.`
                )
              )
                run(
                  () => deleteTeam(team.id),
                  () => router.push("/admin/teams")
                );
            }}
            className="rounded-xl text-destructive hover:text-destructive"
          >
            Delete team
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-primary/30 bg-primary/5">
        <CardContent className="space-y-3 pt-5">
          <h3 className="font-bold">🎁 Grant bonus points</h3>
          <p className="text-sm text-muted-foreground">
            Ad-hoc points with a reason the team will see (use a negative number
            for a penalty).
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              value={bonusPoints}
              onChange={(e) => setBonusPoints(e.target.value)}
              className="h-10 w-24 rounded-xl"
            />
            <Input
              value={bonusReason}
              onChange={(e) => setBonusReason(e.target.value)}
              placeholder="Reason (e.g. best costume at movie night)"
              className="h-10 flex-1 rounded-xl"
            />
          </div>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  grantBonus({
                    teamId: team.id,
                    points: Number(bonusPoints),
                    reason: bonusReason,
                  }),
                () => setBonusReason("")
              )
            }
            className="rounded-xl font-bold"
          >
            Grant
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
