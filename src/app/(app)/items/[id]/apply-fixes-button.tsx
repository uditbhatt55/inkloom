"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Applies every accepted fix on the latest version as a new version, then re-audits it (§8.2). */
export function ApplyFixesButton({ itemId, count }: { itemId: string; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}/apply-fixes`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "The fixes could not be applied.");
      router.push(`/items/${itemId}?v=${body.versionNumber}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The fixes could not be applied.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={onClick} disabled={busy}>
        {busy ? "Applying and re-auditing…" : `Apply ${count} accepted fix${count === 1 ? "" : "es"} as a new version`}
      </Button>
      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  );
}
