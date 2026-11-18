"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Audits the latest version again against today's guidelines and facts (POST /api/items/:id/reaudit). */
export function ReauditButton({ itemId, label = "Re-audit with current rules" }: { itemId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}/reaudit`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "The audit could not be run again.");
      router.push(`/items/${itemId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The audit could not be run again.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <Button onClick={onClick} disabled={busy} variant="outline">
        {busy ? "Re-auditing…" : label}
      </Button>
      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  );
}
