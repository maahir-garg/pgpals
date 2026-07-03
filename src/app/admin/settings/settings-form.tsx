"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { promoteToAdmin, updateSettings } from "../actions";
import { utcToSgtInput } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EventSettings, Profile } from "@/lib/types";

export function SettingsForm({
  settings,
  admins,
}: {
  settings: EventSettings;
  admins: Profile[];
}) {
  const [pending, startTransition] = useTransition();
  const [eventName, setEventName] = useState(settings.event_name);
  const [startAt, setStartAt] = useState(utcToSgtInput(settings.start_at));
  const [endAt, setEndAt] = useState(utcToSgtInput(settings.end_at));
  const [hideAt, setHideAt] = useState(
    utcToSgtInput(settings.leaderboard_hide_at)
  );
  const [domains, setDomains] = useState(
    settings.allowed_email_domains.join(", ")
  );
  const [prizes, setPrizes] = useState(settings.prizes ?? "");
  const [promoteEmail, setPromoteEmail] = useState("");

  function save() {
    if (!startAt || !endAt || !hideAt) {
      toast.error("All three dates are required.");
      return;
    }
    startTransition(async () => {
      const result = await updateSettings({
        eventName,
        startAtSgt: startAt,
        endAtSgt: endAt,
        leaderboardHideAtSgt: hideAt,
        allowedDomains: domains,
        prizes,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  function promote() {
    if (!confirm(`Make ${promoteEmail} an admin? They'll see and control everything.`))
      return;
    startTransition(async () => {
      const result = await promoteToAdmin(promoteEmail);
      if (result.ok) {
        toast.success(result.message);
        setPromoteEmail("");
      } else {
        toast.error(result.error);
      }
    });
  }

  const inputCls = "h-10";

  return (
    <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-4">
          <h2 className="font-bold">Event</h2>
          <div className="space-y-1.5">
            <Label htmlFor="event-name">Event name</Label>
            <Input id="event-name" value={eventName}
              onChange={(e) => setEventName(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start-at">Starts (SGT)</Label>
            <Input id="start-at" type="datetime-local" value={startAt}
              onChange={(e) => setStartAt(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end-at">Ends (SGT)</Label>
            <Input id="end-at" type="datetime-local" value={endAt}
              onChange={(e) => setEndAt(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hide-at">Leaderboard hides (SGT)</Label>
            <Input id="hide-at" type="datetime-local" value={hideAt}
              onChange={(e) => setHideAt(e.target.value)} className={inputCls} />
            <p className="text-xs text-muted-foreground">
              From this moment participants see “results at the closing
              ceremony”. Admins always see the board. Enforced in the database.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prizes">Prizes (shown to residents)</Label>
            <Textarea
              id="prizes"
              value={prizes}
              onChange={(e) => setPrizes(e.target.value)}
              rows={4}
              placeholder={"🥇 1st: dinner vouchers\n🥈 2nd: GrabFood credit"}
            />
            <p className="text-xs text-muted-foreground">
              One prize per line. Appears on the public landing page and the
              leaderboard. Leave empty to keep it a mystery (&quot;exciting
              prizes&quot;).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="domains">Allowed signup domains (optional)</Label>
            <Input id="domains" value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="u.nus.edu, nus.edu.sg" className={inputCls} />
            <p className="text-xs text-muted-foreground">
              Comma-separated. Emails on a team roster can always sign up;
              domains listed here can sign up too (without a team) and be
              assigned later. Leave empty for roster-only.
            </p>
          </div>
          <Button onClick={save} disabled={pending} className="font-bold">
            Save settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h2 className="font-bold">Admins</h2>
          <ul className="space-y-1.5">
            {admins.map((a) => (
              <li key={a.id} className="rounded-md bg-muted px-3 py-2 text-sm">
                <span className="font-semibold">{a.full_name}</span>{" "}
                <span className="text-muted-foreground">· {a.email}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5">
            <Label htmlFor="promote">Promote a user to admin</Label>
            <div className="flex gap-2">
              <Input id="promote" type="email" value={promoteEmail}
                onChange={(e) => setPromoteEmail(e.target.value)}
                placeholder="their@email.com" className={inputCls} />
              <Button onClick={promote} variant="outline"
                disabled={pending || !promoteEmail.includes("@")}
              >
                Promote
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              They must have an account already. Demoting is done in Supabase
              Studio (see README) to avoid accidental lockouts.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
