import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

export type Db = SupabaseClient<Database>;

export class ConfigError extends Error {}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new ConfigError(`${name} is not set`);
  return v;
}

/** The signed-in user's client (anon key + session cookie): every query runs under RLS. Server components and routes only. */
export async function createUserClient(): Promise<Db> {
  const store = await cookies();
  return createServerClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // called from a server component: the middleware refreshes the session instead
        }
      },
    },
  });
}

/**
 * Service-role client: bypasses RLS. Server-only, used for writing audit runs (save_audit) and reading the full
 * knowledge base for the Confidential Guard. Never import this from client components; the key must never reach a browser.
 */
export function createServiceClient(): Db {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
