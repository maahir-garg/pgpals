import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";

// Browser Supabase client (media uploads, auth forms).
export function createClient() {
  return createBrowserClient(
    supabaseUrl!,
    supabasePublishableKey!
  );
}
