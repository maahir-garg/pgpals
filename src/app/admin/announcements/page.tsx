import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data";
import { AnnouncementsManager } from "./announcements-manager";
import type { Announcement } from "@/lib/types";

export const metadata: Metadata = { title: "Announcements" };

export default async function AdminAnnouncementsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="border-b pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Announcements</h1>
      </div>
      <AnnouncementsManager announcements={(data ?? []) as Announcement[]} />
    </div>
  );
}
