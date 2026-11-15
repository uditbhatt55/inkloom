import type { Metadata } from "next";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
    <div className="flex min-h-screen bg-background">
      <main className="flex min-w-0 flex-1 flex-col px-6 py-8">
        <Link href="/" className="flex items-center gap-2.5 self-start font-semibold tracking-tight">
          <span aria-hidden="true" className="size-7 rounded-lg bg-[linear-gradient(135deg,#B9A6E6,#F2B89D)]" />
          INKLOOM AI
        </Link>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="reveal flex w-full max-w-[400px] flex-col gap-7">
            <div className="space-y-2">
              <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.025em]">Sign in to INKLOOM AI</h1>
              <p className="text-[15px] text-muted-foreground">Check content against your brand before it is published.</p>
            </div>
            {showDemo && (
              <section aria-labelledby="demo-heading" className="space-y-3 rounded-xl border border-indigo-200 bg-primary-soft p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="demo-heading" className="text-[15px] font-semibold">Try the demo, no sign-up</h2>
                  <span className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 font-mono text-[11px] text-indigo-800">Northbeam Cloud</span>
                </div>
                <p className="text-sm text-zinc-700">
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
              </section>
            )}
            {showDemo && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground"><Separator className="flex-1" />or use your own account<Separator className="flex-1" /></div>
            )}
            <LoginForm next={safeNext(next)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">AI review runs on Azure AI Foundry when enabled. Demo results are labelled “Simulated analysis”.</p>
      </main>
      <aside aria-hidden="true" className="hidden flex-1 p-6 lg:flex">
        <div className="auth-scene flex flex-1 items-end rounded-3xl border p-10">
          <p className="max-w-sm text-[22px] leading-snug font-medium tracking-[-0.01em] text-indigo-800">“Every finding links to the rule it came from.”</p>
        </div>
      </aside>
    </div>
  );
}
