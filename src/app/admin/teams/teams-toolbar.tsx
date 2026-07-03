"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { createTeam, importTeamsCsv } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function TeamsToolbar() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [newTeamOpen, setNewTeamOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importReport, setImportReport] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [pending, startTransition] = useTransition();

  function onFileChosen(file: File | null) {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await importTeamsCsv(formData);
      setImportReport(result.ok ? (result.message ?? "Imported.") : result.error);
      if (fileInput.current) fileInput.current.value = "";
    });
  }

  function addTeam() {
    startTransition(async () => {
      const result = await createTeam(teamName);
      if (result.ok) {
        toast.success(result.message);
        setTeamName("");
        setNewTeamOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) setImportReport(null);
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" className="font-semibold">
            <FileUp className="size-4" aria-hidden />
            Import CSV
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import teams from CSV</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1 text-sm">
                <p>One team per line, five columns (header row optional):</p>
                <code className="block rounded-lg bg-muted p-2 text-xs">
                  team_name, member1_name, member1_email, member2_name, member2_email
                </code>
                <p>
                  Existing team names and already-rostered emails are skipped
                  with a note, so it&apos;s safe to fix the file and re-import.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            disabled={pending}
            onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          {pending && <p className="text-sm font-semibold">Importing...</p>}
          {importReport && (
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
              {importReport}
            </pre>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={newTeamOpen} onOpenChange={setNewTeamOpen}>
        <DialogTrigger asChild>
          <Button className="font-bold">
            <Plus className="size-4" aria-hidden />
            New team
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New team</DialogTitle>
          </DialogHeader>
          <Input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Team name"
          />
          <Button onClick={addTeam} disabled={pending}>
            Create
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
