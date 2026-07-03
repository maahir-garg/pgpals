import type { Metadata } from "next";
import { requireAdmin, getEventSettings } from "@/lib/data";
import { SettingsForm } from "./settings-form";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const { supabase } = await requireAdmin();
  const settings = await getEventSettings(supabase);
  const { data: admins } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "admin")
    .order("full_name");

  return (
    <div className="space-y-4">
      <div className="border-b-2 border-dashed border-foreground/25 pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Event settings
        </h1>
      </div>
      <SettingsForm settings={settings} admins={(admins ?? []) as Profile[]} />
    </div>
  );
}
