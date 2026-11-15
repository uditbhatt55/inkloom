import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-redirect";
import { createUserClient } from "@/lib/supabase/server";

/**
 * A redirect with a relative Location. Behind Azure App Service the server only knows its inner address
 * (https://0.0.0.0:8080), so an absolute URL built from the request would send people to a page nobody can open.
 * The browser resolves a relative Location against the address it actually used, and keeps any #fragment (Supabase puts
 * its error there when a link has expired).
 */
const go = (path: string) => new NextResponse(null, { status: 307, headers: { Location: path } });

/** Email-confirmation link target: swaps the one-time code for a session cookie, then goes to a same-site page only. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  if (code) {
    try {
      const db = await createUserClient();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) return go(next);
    } catch {
      // not configured: fall through to the login page
    }
  }
  return go("/login");
}
