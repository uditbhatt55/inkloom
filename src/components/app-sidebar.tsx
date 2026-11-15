"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, HeartPulse, Plus } from "lucide-react";
import { cn } from "cn";
import { SignOutButton } from "@/components/sign-out-button";

/** App shell navigation (DESIGN.md §4): sidebar ≥1024px, icon rail 768–1023px, top bar + bottom tabs below 768px. */
export type ShellProps = {
  orgName: string | null;
  demo: boolean;
  roleLabel: string | null;
  email: string | null;
  showHealth: boolean;
  showNewAudit: boolean;
};

const NAV = [
  { href: "/dashboard", label: "Content", short: "Content", icon: FileText, match: ["/dashboard", "/items"] },
  { href: "/audit/new", label: "New audit", short: "Audit", icon: Plus, match: ["/audit"] },
  { href: "/knowledge", label: "Knowledge Centre", short: "Knowledge", icon: BookOpen, match: ["/knowledge"] },
  { href: "/health", label: "Brand Health", short: "Health", icon: HeartPulse, match: ["/health"] },
] as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

function Logo({ withText = true }: { withText?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md px-2 py-1 font-semibold tracking-tight">
      <span aria-hidden="true" className="size-6 shrink-0 rounded-md bg-[linear-gradient(135deg,#B9A6E6,#F2B89D)]" />
      <span className={withText ? "md:sr-only lg:not-sr-only" : "sr-only"}>INKLOOM AI</span>
    </Link>
  );
}

export function AppSidebar(p: ShellProps) {
  const pathname = usePathname();
  const items = NAV.filter((n) => (n.href === "/health" ? p.showHealth : n.href === "/audit/new" ? p.showNewAudit : true));
  const isActive = (m: readonly string[]) => m.some((x) => pathname === x || pathname.startsWith(`${x}/`));

  return (
    <>
      {/* Tablet rail + desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen shrink-0 flex-col gap-5 border-r bg-sidebar px-3 py-4 md:flex md:w-16 lg:w-60">
        <Logo />
        {p.orgName && (
          <div className="flex items-center gap-2.5 rounded-lg border bg-background px-2 py-2 md:justify-center lg:justify-start">
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-soft text-xs font-semibold text-sidebar-accent-foreground">
              {initials(p.orgName)}
            </span>
            <span className="hidden min-w-0 flex-col lg:flex">
              <span className="truncate text-sm font-medium">{p.orgName}</span>
              {p.demo && <span className="font-mono text-[11px] text-muted-foreground">Demo org</span>}
            </span>
          </div>
        )}
        {p.showNewAudit && (
          <Link
            href="/audit/new"
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span className="md:sr-only lg:not-sr-only">New audit</span>
          </Link>
        )}
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {items.map((n) => {
            const active = isActive(n.match);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                title={n.label}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-150 md:justify-center lg:justify-start",
                  active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-zinc-700 hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="md:sr-only lg:not-sr-only">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        {p.email && (
          <div className="mt-auto flex flex-col gap-2 border-t pt-3 lg:flex-row lg:items-center">
            <span aria-hidden="true" className="mx-auto size-8 shrink-0 rounded-full bg-zinc-200 lg:mx-0" />
            <span className="hidden min-w-0 flex-1 flex-col lg:flex">
              <span className="truncate text-sm font-medium">{p.email}</span>
              {p.roleLabel && <span className="text-xs text-muted-foreground">{p.roleLabel}</span>}
            </span>
            <SignOutButton />
          </div>
        )}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <Logo />
        <div className="ml-auto flex items-center gap-2">
          {p.showNewAudit && (
            <Link href="/audit/new" aria-label="New audit" className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Plus className="size-5" aria-hidden="true" />
            </Link>
          )}
          {p.email && <SignOutButton />}
        </div>
      </header>

      {/* Mobile bottom tabs */}
      <nav aria-label="Main (mobile)" className="fixed inset-x-0 bottom-0 z-30 grid h-16 border-t bg-background md:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((n) => {
          const active = isActive(n.match);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn("flex flex-col items-center justify-center gap-1 text-[11px]", active ? "font-semibold text-sidebar-accent-foreground" : "text-muted-foreground")}
            >
              <Icon className="size-5" aria-hidden="true" />
              {n.short}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
