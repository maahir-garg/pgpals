"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addRosterMember,
  deleteTeam,
  grantBonus,
  moveRosterMember,
  removeRosterMember,
  renameTeamAdmin,
} from "../../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RosterEntry, Team } from "@/lib/types";

type RosterWithStatus = RosterEntry & { signedUp: boolean };

export function TeamAdminPanel({
  team,
  roster,
  otherTeams,
}: {
  team: Team;
  roster: RosterWithStatus[];
  otherTeams: Pick<Team, "id" | "name">[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(team.name);
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [bonusPoints, setBonusPoints] = useState("5");
  const [bonusReason, setBonusReason] = useState("");
  const [movingMember, setMovingMember] = useState<RosterWithStatus | null>(null);
  const [moveTarget, setMoveTarget] = useState("");

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
      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Team name</Label>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  () => renameTeamAdmin(team.id, name),
                  () => {
                    setName(name.trim());
                    router.refresh();
                  }
                );
              }}
            >
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="h-10"
              />
              <Button
                type="submit"
                disabled={pending || name.trim().length < 2}
              >
                {pending ? "Renaming..." : "Rename"}
              </Button>
            </form>
          </div>

          <div className="space-y-2">
            <Label>Members</Label>
            {roster.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-semibold">{m.full_name}</span>{" "}
                  <span
                    className={
                      m.signedUp
                        ? "rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary"
                        : "rounded-md bg-card px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground"
                    }
                    title={m.signedUp ? "Signed up" : "Not signed up yet"}
                  >
                    {m.signedUp ? "Signed" : "Roster"}
                  </span>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending || otherTeams.length === 0}
                    onClick={() => {
                      setMoveTarget("");
                      setMovingMember(m);
                    }}
                  >
                    Move
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Remove ${m.full_name} from this team's roster?`))
                        run(() => removeRosterMember(m.id));
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Input
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Full name"
                className="h-9 flex-1"
              />
              <Input
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="email@u.nus.edu"
                className="h-9 flex-1"
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
                className="h-9"
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
                  `Delete team "${team.name}"? Their submissions and coins will be gone. This cannot be undone.`
                )
              )
                run(
                  () => deleteTeam(team.id),
                  () => router.push("/admin/teams")
                );
            }}
            className="text-destructive hover:text-destructive"
          >
            Delete team
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-3">
          <h3 className="font-bold">Grant bonus coins</h3>
          <p className="text-sm text-muted-foreground">
            Ad-hoc points with a reason the team will see (use a negative number
            for a penalty).
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              value={bonusPoints}
              onChange={(e) => setBonusPoints(e.target.value)}
              className="h-10 w-24"
            />
            <Input
              value={bonusReason}
              onChange={(e) => setBonusReason(e.target.value)}
              placeholder="Reason (e.g. best costume at movie night)"
              className="h-10 flex-1"
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
            className="font-bold"
          >
            Grant
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={movingMember !== null}
        onOpenChange={(open) => {
          if (!open) setMovingMember(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move {movingMember?.full_name}</DialogTitle>
            <DialogDescription>
              Regroup them onto another team. Coins and submissions already
              earned stay with {team.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="move-target">Destination team</Label>
            <select
              id="move-target"
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
              className="h-10 w-full rounded-lg border-2 border-input bg-card px-3 text-sm outline-none focus-visible:border-primary"
            >
              <option value="">Pick a team...</option>
              {otherTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={pending || !moveTarget || !movingMember}
            onClick={() =>
              run(
                () =>
                  moveRosterMember({
                    rosterId: movingMember!.id,
                    toTeamId: moveTarget,
                  }),
                () => setMovingMember(null)
              )
            }
            className="font-bold"
          >
            Move member
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
