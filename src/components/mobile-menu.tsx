"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

/** Landing nav below 768px (DESIGN.md §4, §7): a menu button that opens a full-width sheet. Esc closes it and focus returns to the button. */
export function MobileMenu({ links }: { links: readonly (readonly [string, string])[] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); button.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
        className="relative z-50 flex size-11 items-center justify-center rounded-full border border-input bg-white/80 text-foreground"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>
      {open && (
        <div id="mobile-menu" className="fixed inset-0 z-40 flex flex-col bg-background/97 px-6 pt-24 pb-10 backdrop-blur-sm animate-in fade-in duration-200">
          <nav aria-label="Sections" className="flex flex-col gap-1">
            {links.map(([href, label], i) => (
              <a
                key={href}
                ref={i === 0 ? first : undefined}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-4 text-2xl font-semibold tracking-tight hover:bg-lavender"
              >
                {label}
              </a>
            ))}
          </nav>
          <Link href="/login" onClick={() => setOpen(false)} className="mt-auto flex h-12 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground">
            Try the demo
          </Link>
        </div>
      )}
    </div>
  );
}
