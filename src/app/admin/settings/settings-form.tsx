"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addAdminEmail, removeAdminEmail, updateSettings } from "../actions";
import { utcToSgtInput } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EventSettings, Profile } from "@/lib/types";

export function SettingsForm({
  settings,
  admins,
  allowlist,
}: {
  settings: EventSettings;
  admins: Profile[];
  allowlist: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [eventName, setEventName] = useState(settings.event_name);
  const [startAt, setStartAt] = useState(utcToSgtInput(settings.start_at));
  const [endAt, setEndAt] = useState(utcToSgtInput(settings.end_at));
  const [hideAt, setHideAt] = useState(
    utcToSgtInput(settings.leaderboard_hide_at)
  );
  const [newAdminEmail, setNewAdminEmail] = useState("");

  // One row per RA: allowlisted emails first (signed up or not), then any
  // admins who predate the list (promoted before it became the single path).
  const adminByEmail = new Map(admins.map((a) => [a.email, a]));
  const legacyAdmins = admins.filter((a) => !allowlist.includes(a.email));

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
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  function addEmail() {
    startTransition(async () => {
      const result = await addAdminEmail(newAdminEmail);
      if (result.ok) {
        toast.success(result.message);
        setNewAdminEmail("");
      } else {
        toast.error(result.error);
      }
    });
  }

  function removeEmail(email: string) {
    if (
      !confirm(
        `Remove ${email} from the admin list? They won't become an admin at signup anymore.`
      )
    )
      return;
    startTransition(async () => {
      const result = await removeAdminEmail(email);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
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
          <p className="text-xs text-muted-foreground">
            The prize messaging is fixed for this run and lives in the code
            (src/lib/prizes.ts): top 8 tech prize pool led by an iPad, monitors,
            Sony headphones, projectors, AirPods lucky draw, finale reveal, and
            participation goodie bags.
          </p>
          <Button onClick={save} disabled={pending} className="font-bold">
            Save settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h2 className="font-bold">Admins (RAs)</h2>
          <p className="text-sm text-muted-foreground">
            An email on this list becomes an admin the moment it signs up, so
            add every RA here before they create their account. Residents
            can&apos;t use this route: their signup email has to be on a team
            roster.
          </p>
          <ul className="space-y-1.5">
            {allowlist.map((email) => {
              const profile = adminByEmail.get(email);
              return (
                <li
                  key={email}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    {profile && (
                      <span className="font-semibold">{profile.full_name} · </span>
                    )}
                    <span className="break-all text-muted-foreground">{email}</span>{" "}
                    <span
                      className={
                        profile
                          ? "rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary"
                          : "rounded-md bg-card px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground"
                      }
                    >
                      {profile ? "Admin" : "Not signed up"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => removeEmail(email)}
                    className="shrink-0 text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
            {allowlist.length === 0 && (
              <li className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                No RA emails yet. Add the first one below.
              </li>
            )}
            {legacyAdmins.map((a) => (
              <li key={a.id} className="rounded-md bg-muted px-3 py-2 text-sm">
                <span className="font-semibold">{a.full_name}</span>{" "}
                <span className="text-muted-foreground">· {a.email}</span>{" "}
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                  Admin
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5">
            <Label htmlFor="new-admin">Add an RA email</Label>
            <div className="flex gap-2">
              <Input id="new-admin" type="email" value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="ra@u.nus.edu" className={inputCls} />
              <Button onClick={addEmail} variant="outline"
                disabled={pending || !newAdminEmail.includes("@")}
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              If they already have an account it is promoted right away.
              Removing an email only blocks future signups; demoting an
              existing admin is done in Supabase Studio (see README) to avoid
              accidental lockouts.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
