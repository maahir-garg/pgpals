"use client";

import { useState, useTransition } from "react";
import { Check, Search, Send, X } from "lucide-react";
import { toast } from "sonner";
import { cancelInvite, invitePartners, respondInvite } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Pairing } from "@/lib/types";

type TeamOption = { id: string; name: string };

// Group-task flow: select every partner -> invite -> everyone accepts -> any
// member team submits one joint submission. The database re-checks all rules.
export function PairPanel({
  taskId,
  myTeamId,
  pairing,
  groupTeams,
  requiredTeamCount,
  availableTeams,
  closed,
}: {
  taskId: string;
  myTeamId: string;
  pairing: Pairing | null;
  groupTeams: (TeamOption & { accepted: boolean })[];
  requiredTeamCount: number;
  availableTeams: TeamOption[];
  closed: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(okMsg);
      else toast.error(result.error ?? "Something went wrong.");
    });
  }

  if (pairing?.status === "accepted") {
    const otherNames = groupTeams
      .filter((team) => team.id !== myTeamId)
      .map((team) => team.name)
      .join(", ");
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="space-y-2">
          <p className="font-bold">Grouped with {otherNames}</p>
          <p className="text-sm text-muted-foreground">
            Any team can submit. All {requiredTeamCount} teams get the coins
            when it&apos;s approved!
          </p>
        </CardContent>
      </Card>
    );
  }

  if (pairing?.status === "pending") {
    const iCreated = pairing.created_by_team === myTeamId;
    const iAccepted = pairing.accepted_team_ids.includes(myTeamId);
    const acceptedCount = pairing.accepted_team_ids.length;
    const creatorName =
      groupTeams.find((team) => team.id === pairing.created_by_team)?.name ??
      "A team";
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="space-y-4">
          {iCreated || iAccepted ? (
            <>
              <p className="font-bold">
                Group invite: {acceptedCount} of {requiredTeamCount} teams
                accepted
              </p>
              <p className="text-sm text-muted-foreground">
                Waiting for{" "}
                {groupTeams
                  .filter((team) => !team.accepted)
                  .map((team) => team.name)
                  .join(", ")}
                .
              </p>
              {iCreated && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => cancelInvite(taskId, pairing.id),
                      "Invite cancelled."
                    )
                  }
                >
                  <X className="size-4" aria-hidden />
                  Cancel group invite
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="font-bold">
                {creatorName} invited you to a {requiredTeamCount}-team group!
              </p>
              <p className="text-sm text-muted-foreground">
                The group also includes{" "}
                {groupTeams
                  .filter((team) => team.id !== myTeamId)
                  .map((team) => team.name)
                  .join(", ")}
                .
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending || closed}
                  onClick={() =>
                    run(
                      () => respondInvite(taskId, pairing.id, true),
                      "Invite accepted!"
                    )
                  }
                >
                  <Check className="size-4" aria-hidden />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => respondInvite(taskId, pairing.id, false),
                      "Invite declined."
                    )
                  }
                >
                  <X className="size-4" aria-hidden />
                  Decline
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  if (closed) {
    return (
      <Card className="bg-muted">
        <CardContent className="text-sm text-muted-foreground">
          This task closed before a pairing was made.
        </CardContent>
      </Card>
    );
  }

  const filtered = availableTeams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );
  const partnerSlots = requiredTeamCount - 1;

  function toggleTeam(teamId: string) {
    setSelectedIds((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : current.length < partnerSlots
          ? [...current, teamId]
          : current
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-4">
        <div>
          <p className="font-bold">
            Choose {partnerSlots} partner {partnerSlots === 1 ? "team" : "teams"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone must accept before any team can submit.
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team names"
            className="bg-card pl-9"
          />
        </div>
        <div className="max-h-48 space-y-1.5 overflow-y-auto">
          {filtered.slice(0, 30).map((t) => (
            <div
              key={t.id}
              className="grid min-w-0 gap-2 rounded-md bg-card px-3 py-2 shadow-sm ring-1 ring-border sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3"
            >
              <span className="min-w-0 text-sm font-semibold leading-snug">
                {t.name}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="w-fit"
                disabled={pending}
                onClick={() => toggleTeam(t.id)}
              >
                {selectedIds.includes(t.id) && (
                  <Check className="size-4" aria-hidden />
                )}
                {selectedIds.includes(t.id) ? "Selected" : "Select"}
              </Button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-2 text-center text-sm text-muted-foreground">
              No available teams match. They may already be paired up.
            </p>
          )}
        </div>
        <Button
          className="w-full"
          disabled={pending || selectedIds.length !== partnerSlots}
          onClick={() =>
            run(() => invitePartners(taskId, selectedIds), "Group invite sent!")
          }
        >
          <Send className="size-4" aria-hidden />
          Invite {selectedIds.length} of {partnerSlots}
        </Button>
      </CardContent>
    </Card>
  );
}
