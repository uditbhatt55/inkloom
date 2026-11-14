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
            Ask your brand owner to add you. To try INKLOOM now, sign out and choose <strong>Try the demo</strong> on the{" "}
            <Link href="/login" className="underline underline-offset-4">sign-in page</Link>.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
