"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelInvite, invitePartner, respondInvite } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Pairing } from "@/lib/types";

type TeamOption = { id: string; name: string };

// Pair-task partner flow: pick a team -> invite -> they accept -> either team
// submits one joint submission. All rules re-checked by database RPCs.
export function PairPanel({
  taskId,
  myTeamId,
  pairing,
  partnerName,
  availableTeams,
  closed,
}: {
  taskId: string;
  myTeamId: string;
  pairing: Pairing | null;
  partnerName: string | null;
  availableTeams: TeamOption[];
  closed: boolean;
}) {
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(okMsg);
      else toast.error(result.error ?? "Something went wrong.");
    });
  }

  if (pairing?.status === "accepted") {
    return (
      <Card className="rounded-2xl bg-accent/60">
        <CardContent className="pt-5">
          <p className="font-bold">🤝 Paired with {partnerName}</p>
          <p className="text-sm text-muted-foreground">
            Either team can submit, and you&apos;ll both get the points when it&apos;s
            approved!
          </p>
        </CardContent>
      </Card>
    );
  }

  if (pairing?.status === "pending") {
    const iInvited = pairing.created_by_team === myTeamId;
    return (
      <Card className="rounded-2xl bg-accent/60">
        <CardContent className="space-y-3 pt-5">
          {iInvited ? (
            <>
              <p className="font-bold">📨 Invite sent to {partnerName}</p>
              <p className="text-sm text-muted-foreground">
                Waiting for them to accept…
              </p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={pending}
                onClick={() =>
                  run(() => cancelInvite(taskId, pairing.id), "Invite cancelled.")
                }
              >
                Cancel invite
              </Button>
            </>
          ) : (
            <>
              <p className="font-bold">📬 {partnerName} wants to pair with you!</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="rounded-xl"
                  disabled={pending || closed}
                  onClick={() =>
                    run(
                      () => respondInvite(taskId, pairing.id, true),
                      "You're paired up! 🎉"
                    )
                  }
                >
                  Accept 🤝
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => respondInvite(taskId, pairing.id, false),
                      "Invite declined."
                    )
                  }
                >
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
      <Card className="rounded-2xl bg-muted">
        <CardContent className="pt-5 text-sm text-muted-foreground">
          This task closed before a pairing was made.
        </CardContent>
      </Card>
    );
  }

  const filtered = availableTeams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="rounded-2xl bg-accent/60">
      <CardContent className="space-y-3 pt-5">
        <p className="font-bold">🤝 This is a pair task!</p>
        <p className="text-sm text-muted-foreground">
          Team up with another duo. Find them below and send an invite.
        </p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team names…"
          className="bg-card"
        />
        <div className="max-h-48 space-y-1.5 overflow-y-auto">
          {filtered.slice(0, 30).map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl bg-card px-3 py-2"
            >
              <span className="text-sm font-semibold">{t.name}</span>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={pending}
                onClick={() =>
                  run(() => invitePartner(taskId, t.id), "Invite sent! 📨")
                }
              >
                Invite
              </Button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-2 text-center text-sm text-muted-foreground">
              No available teams match. They may already be paired up.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
