import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-redirect";
import { createUserClient } from "@/lib/supabase/server";

/** Email-confirmation link target: swaps the one-time code for a session cookie, then goes to a same-site page only. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  if (code) {
    try {
      const db = await createUserClient();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, req.nextUrl.origin));
    } catch {
      // not configured: fall through to the login page
    }
  }
  return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
}
