"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeBonusAward } from "../../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatSGT } from "@/lib/datetime";
import type { BonusAward } from "@/lib/types";

export function BonusAwardsList({
  teamId,
  bonuses,
}: {
  teamId: string;
  bonuses: BonusAward[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove(bonus: BonusAward) {
    const amount = `${bonus.points > 0 ? "+" : ""}${bonus.points}`;
    if (!confirm(`Remove the ${amount}-coin award “${bonus.reason}”?`)) return;

    startTransition(async () => {
      const result = await removeBonusAward({ teamId, bonusId: bonus.id });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (bonuses.length === 0) {
    return <p className="text-sm text-muted-foreground">No manual bonuses yet.</p>;
  }

  return (
    <Card>
      <CardContent className="divide-y">
        {bonuses.map((bonus) => (
          <div
            key={bonus.id}
            className="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="font-semibold">{bonus.reason}</div>
              <div className="text-xs text-muted-foreground">
                {formatSGT(bonus.created_at)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-bold text-primary">
                {bonus.points > 0 ? "+" : ""}
                {bonus.points}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => remove(bonus)}
                className="text-destructive hover:text-destructive"
                aria-label={`Remove bonus: ${bonus.reason}`}
              >
                <Trash2 className="size-4" aria-hidden />
                Remove
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
