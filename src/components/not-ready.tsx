import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Shown when Supabase keys are missing, or the user belongs to no organisation yet. */
export function NotReady({ kind }: { kind: "not_configured" | "no_org" }) {
  return (
    <Alert className="max-w-xl">
      <AlertTitle>{kind === "not_configured" ? "Not set up yet" : "You are not in an organisation yet"}</AlertTitle>
      <AlertDescription>
        {kind === "not_configured" ? (
          <p>Supabase keys are missing on this server. Add them to <code>.env.local</code> (see <code>.env.example</code>).</p>
        ) : (
          <p>
            Ask your brand owner to add you. For the demo, run <code>supabase/demo-membership.sql</code> with your email, then{" "}
            <Link href="/dashboard" className="underline underline-offset-4">reload</Link>.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
