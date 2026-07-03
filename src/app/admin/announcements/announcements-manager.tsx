"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAnnouncement, saveAnnouncement, togglePin } from "../actions";
import { formatSGT } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { Announcement } from "@/lib/types";

export function AnnouncementsManager({
  announcements,
}: {
  announcements: Announcement[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [pending, startTransition] = useTransition();

  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setPinned(a.pinned);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setPinned(false);
  }

  function save() {
    startTransition(async () => {
      const result = await saveAnnouncement({ id: editingId, title, body, pinned });
      if (result.ok) {
        toast.success(result.message);
        reset();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <Card className="max-w-2xl rounded-2xl">
        <CardContent className="space-y-3 pt-5">
          <h2 className="font-bold">
            {editingId ? "✏️ Edit announcement" : "📣 New announcement"}
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Week 2 tasks are live! 🎉"
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann-body">Body (markdown)</Label>
            <Textarea
              id="ann-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ann-pinned" checked={pinned} onCheckedChange={setPinned} />
            <Label htmlFor="ann-pinned">📌 Pin to top</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={pending} className="rounded-xl font-bold">
              {editingId ? "Save changes" : "Post"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={reset} className="rounded-xl">
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="max-w-2xl space-y-2">
        {announcements.map((a) => (
          <Card key={a.id} className="rounded-2xl">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold">
                    {a.pinned && "📌 "}
                    {a.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {formatSGT(a.created_at)}
                  </p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {a.body}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await togglePin(a.id, !a.pinned);
                        if (!r.ok) toast.error(r.error);
                      })
                    }
                    className="rounded-lg"
                    title={a.pinned ? "Unpin" : "Pin"}
                  >
                    📌
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(a)}
                    className="rounded-lg"
                    title="Edit"
                  >
                    ✏️
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Delete "${a.title}"?`))
                        startTransition(async () => {
                          const r = await deleteAnnouncement(a.id);
                          if (r.ok) toast.success(r.message);
                          else toast.error(r.error);
                        });
                    }}
                    className="rounded-lg text-destructive hover:text-destructive"
                    title="Delete"
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {announcements.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing posted yet.</p>
        )}
      </div>
    </div>
  );
}
