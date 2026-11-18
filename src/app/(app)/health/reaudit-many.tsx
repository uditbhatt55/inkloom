"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Re-audits several posts against today's facts and rules, one after another (POST /api/items/:id/reaudit), so the
 * owner can act on a fact alert in one click. Stops at the first refusal (for example the burst limit) and says why.
 */
export function ReauditMany({ itemIds }: { itemIds: string[] }) {
  const router = useRouter();
  const [state, setState] = useState<{ done: number; error: string | null; busy: boolean }>({ done: 0, error: null, busy: false });

  async function run() {
    setState({ done: 0, error: null, busy: true });
    for (let i = 0; i < itemIds.length; i++) {
      const res = await fetch(`/api/items/${itemIds[i]}/reaudit`, { method: "POST" }).catch(() => null);
      if (!res?.ok) {
        const body = await res?.json().catch(() => ({}));
        setState({ done: i, busy: false, error: typeof body?.error === "string" ? body.error : "A re-audit failed. Please try again." });
        router.refresh();
        return;
      }
      setState({ done: i + 1, error: null, busy: true });
    }
    setState({ done: itemIds.length, error: null, busy: false });
    router.refresh();
  }

  const n = itemIds.length;
  return (
    <div className="mt-2 space-y-1">
      <Button size="sm" variant="outline" onClick={run} disabled={state.busy}>
        {state.busy ? `Re-auditing ${state.done + 1} of ${n}…` : `Re-audit ${n === 1 ? "this post" : `all ${n} posts`} now`}
      </Button>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {state.error ? <span className="text-red-600 dark:text-red-400">{state.error} ({state.done} of {n} done)</span>
          : !state.busy && state.done === n && state.done > 0 ? `Done: ${n} re-audited. Open each post to see its new findings.` : null}
      </p>
    </div>
  );
}
