import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventSettings, Profile } from "@/lib/types";

// Loads the logged-in user's profile or bounces to /login.
export async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) redirect("/login");

  return { supabase, profile };
}

export async function requireAdmin() {
  const result = await requireProfile();
  if (result.profile.role !== "admin") redirect("/dashboard");
  return result;
}

export async function getEventSettings(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<EventSettings> {
  const { data } = await supabase
    .from("event_settings")
    .select("*")
    .eq("id", 1)
    .single<EventSettings>();
  return data!;
}
