import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * In-process Postgres (PGlite) with the small part of Supabase our migrations rely on:
 * an `auth` schema with `users` and `auth.uid()`, and the anon / authenticated / service_role roles with
 * Supabase's default grants. Lets RLS, triggers and save_audit() be tested in CI without Docker.
 * It is NOT a full Supabase: no GoTrue, Storage or PostgREST. Use `supabase start` for those (tests/db/README.md).
 */
export const SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                         (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

export const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SHIM);
  for (const f of readdirSync(MIGRATIONS_DIR).filter((x) => x.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
    } catch (e) {
      throw new Error(`migration ${f} failed: ${(e as Error).message}`);
    }
  }
  return db;
}

/** Run SQL as a signed-in user (RLS applies), inside a transaction that is always rolled back. */
export async function asUser<T>(db: PGlite, userId: string, fn: (tx: Pick<PGlite, "query" | "exec">) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: userId, role: "authenticated" })}', true);`);
    try {
      return await fn(tx);
    } finally {
      await tx.rollback();
    }
  }) as Promise<T>;
}
