"use server";
import { redirect } from "next/navigation";
import { demoAccount, type DemoRole } from "@/lib/demo-accounts";
import { createUserClient } from "@/lib/supabase/server";

/** One-click sign-in to a shared demo account. The password is read on the server; the browser only sends the role. */
export async function demoSignIn(formData: FormData) {
  const role: DemoRole = formData.get("as") === "reviewer" ? "reviewer" : "owner";
  const account = demoAccount(role);
  if (!account) redirect("/login?demo=off");
  const db = await createUserClient();
  const { error } = await db.auth.signInWithPassword(account);
  if (error) redirect("/login?demo=failed");
  redirect("/dashboard");
}
