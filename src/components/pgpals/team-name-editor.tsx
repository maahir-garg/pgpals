"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { renameTeam } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function TeamNameEditor({ currentName }: { currentName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await renameTeam(name);
      if (result.ok) {
        toast.success("Team name updated! ✨");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="text-sm font-semibold text-primary underline underline-offset-2"
          aria-label="Edit team name"
        >
          ✏️ edit
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Name your team</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="The Dumpling Duo"
        />
        <Button onClick={save} disabled={pending} className="rounded-xl">
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
