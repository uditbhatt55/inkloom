import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { NotReady } from "@/components/not-ready";
import { ROLE_LABEL } from "@/lib/labels";
import { canSubmit, getViewer } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (viewer.state === "signed_out") redirect("/login");

  const signedIn = viewer.state === "signed_in";
  const first = signedIn ? viewer.memberships[0] : undefined;
  const roles = signedIn ? viewer.memberships.map((m) => m.role) : [];

  return (
    <div className="flex min-h-screen bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        <AppSidebar
          orgName={first?.orgName ?? null}
          demo={first?.demo ?? false}
          roleLabel={first ? ROLE_LABEL[first.role] : null}
          email={signedIn ? viewer.email : null}
          // Brand Health is for owners and reviewers (§8.1); the page itself also checks.
          showHealth={!signedIn || roles.some((r) => r === "owner" || r === "reviewer")}
          showNewAudit={!signedIn || roles.some(canSubmit)}
        />
        <main id="main" className="min-w-0 flex-1 px-4 pt-6 pb-24 sm:px-6 md:px-8 md:pt-8 md:pb-12">
          <div className="mx-auto w-full max-w-6xl">
            {viewer.state === "not_configured" ? <NotReady kind="not_configured" /> : children}
          </div>
        </main>
      </div>
    </div>
  );
}
