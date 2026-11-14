import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { demoEnabled } from "@/lib/demo-accounts";
import { safeNext } from "@/lib/safe-redirect";
import { demoSignIn } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · INKLOOM AI" };

const DEMO_ERROR: Record<string, string> = {
  off: "The demo accounts are not set up on this server.",
  failed: "The demo sign-in did not work. Please try again in a minute.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; demo?: string }> }) {
  const { next, demo } = await searchParams;
  const showDemo = demoEnabled();
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-xl leading-none font-semibold">Sign in to INKLOOM AI</h1>
          <CardDescription>Check content against your brand before it is published.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showDemo && (
            <section aria-labelledby="demo-heading" className="space-y-3">
              <h2 id="demo-heading" className="text-sm font-medium">Try the demo, no sign-up</h2>
              <p className="text-sm text-muted-foreground">
                Sign in to the sample brand <strong>Northbeam Cloud</strong>. Write and audit content as the brand owner, then switch to the
                reviewer to approve it (nobody can approve their own work). These accounts are shared, so other visitors can see your changes.
              </p>
              <form action={demoSignIn} className="grid grid-cols-2 gap-2">
                <Button type="submit" name="as" value="owner">Brand owner</Button>
                <Button type="submit" name="as" value="reviewer" variant="outline">Reviewer</Button>
              </form>
              {demo && DEMO_ERROR[demo] && (
                <Alert variant="destructive" role="alert"><AlertDescription>{DEMO_ERROR[demo]}</AlertDescription></Alert>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground"><Separator className="flex-1" />or use your own account<Separator className="flex-1" /></div>
            </section>
          )}
          <LoginForm next={safeNext(next)} />
        </CardContent>
      </Card>
    </main>
  );
}
