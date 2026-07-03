import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";

// Browser Supabase client (photo uploads, auth forms).
export function createClient() {
  return createBrowserClient(
    supabaseUrl!,
    supabasePublishableKey!
  );
}
