import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventSettings, Profile } from "@/lib/types";

// Loads the logged-in user's profile or bounces to /login.
export const requireProfile = cache(async function requireProfile() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .rpc("get_my_profile")
    .single<Profile>();
  if (!profile) redirect("/login");

  return { supabase, profile };
});

export const requireAdmin = cache(async function requireAdmin() {
  const result = await requireProfile();
  if (result.profile.role !== "admin") redirect("/dashboard");
  return result;
});

export const getEventSettings = cache(async function getEventSettings(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<EventSettings> {
  const { data } = await supabase
    .from("event_settings")
    .select("*")
    .eq("id", 1)
    .single<EventSettings>();
  return data!;
});

export const getMyScore = cache(async function getMyScore(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  const { data } = await supabase.rpc("get_my_score");
  return data ?? 0;
});
