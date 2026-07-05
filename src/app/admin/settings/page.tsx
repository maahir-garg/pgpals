import type { Metadata } from "next";
import { requireAdmin, getEventSettings } from "@/lib/data";
import { SettingsForm } from "./settings-form";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const { supabase } = await requireAdmin();
  const settings = await getEventSettings(supabase);
  const [{ data: admins }, { data: allowlist }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "admin").order("full_name"),
    supabase.from("admin_allowlist").select("email").order("email"),
  ]);

  return (
    <div className="space-y-4">
      <div className="border-b-2 border-dashed border-foreground/25 pb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Event settings
        </h1>
      </div>
      <SettingsForm
        settings={settings}
        admins={(admins ?? []) as Profile[]}
        allowlist={(allowlist ?? []).map((row) => row.email as string)}
      />
    </div>
  );
}
