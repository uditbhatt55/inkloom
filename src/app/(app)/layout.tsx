import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { NotReady } from "@/components/not-ready";
import { getViewer } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (viewer.state === "signed_out") redirect("/login");

  return (
    <div className="min-h-screen bg-muted/30">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">INKLOOM AI</Link>
          <nav aria-label="Main" className="flex gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">Content</Link>
            <Link href="/audit/new" className="text-muted-foreground hover:text-foreground">New audit</Link>
            <Link href="/knowledge" className="text-muted-foreground hover:text-foreground">Knowledge</Link>
            <Link href="/health" className="text-muted-foreground hover:text-foreground">Brand Health</Link>
          </nav>
          {viewer.state === "signed_in" && (
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="hidden text-muted-foreground sm:inline">{viewer.email}</span>
              <SignOutButton />
            </div>
          )}
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8">
        {viewer.state === "not_configured" ? <NotReady kind="not_configured" /> : children}
      </main>
    </div>
  );
}
