"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Org = { orgId: string; orgName: string };
type Source = "text" | "file" | "url";

const CHANNELS = ["linkedin", "instagram", "x", "email", "web", "ad", "press", "brochure"];
const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function AuditForm({ orgs, item }: { orgs: Org[]; item: { id: string; title: string } | null }) {
  const router = useRouter();
  const [source, setSource] = useState<Source>("text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // send only the active source, so the server gets exactly one
    for (const s of ["text", "file", "url"] as const) if (s !== source) fd.delete(s);
    if (source !== "file") for (const k of ["altText", "textColour", "bgColour", "largeText"]) fd.delete(k);
    if (fd.get("useColours") !== "on") { fd.delete("textColour"); fd.delete("bgColour"); fd.delete("largeText"); }
    fd.delete("useColours");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/audit", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "The audit could not be completed.");
      router.push(`/items/${body.itemId}?run=${body.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The audit could not be completed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {item ? (
        <input type="hidden" name="itemId" value={item.id} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} placeholder="Spring launch LinkedIn post" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orgId">Organisation</Label>
            <select id="orgId" name="orgId" className={selectClass} defaultValue={orgs[0]?.orgId} required>
              {orgs.map((o) => <option key={o.orgId} value={o.orgId}>{o.orgName}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel">Channel</Label>
            <select id="channel" name="channel" className={selectClass} defaultValue="linkedin">
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Audience</legend>
            <div className="flex gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="audience" value="public" defaultChecked /> Public (published)</label>
              <label className="flex items-center gap-2"><input type="radio" name="audience" value="internal" /> Internal only</label>
            </div>
            <p className="text-xs text-muted-foreground">Public content is also checked for leaked internal information.</p>
          </fieldset>
        </div>
      )}

      <Tabs value={source} onValueChange={(v) => setSource(v as Source)}>
        <TabsList aria-label="What to audit">
          <TabsTrigger value="text">Paste text</TabsTrigger>
          <TabsTrigger value="file">Upload file</TabsTrigger>
          <TabsTrigger value="url">Web page</TabsTrigger>
        </TabsList>
        <TabsContent value="text" className="space-y-2 pt-4">
          <Label htmlFor="text">Content</Label>
          <Textarea id="text" name="text" rows={10} maxLength={200000} required={source === "text"} placeholder="Paste the post, email or ad copy…" />
        </TabsContent>
        <TabsContent value="file" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input id="file" name="file" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt,.html" required={source === "file"} />
            <p className="text-xs text-muted-foreground">PDF, Word (.docx), PNG, JPG, WebP or text, up to 10 MB. Scanned PDFs are not supported yet.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="altText">Alt text (for an image)</Label>
            <Input id="altText" name="altText" maxLength={1000} placeholder="What the image shows, for screen-reader users" />
          </div>
          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Text on the image: check exact colours</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <label className="flex items-center gap-2 sm:col-span-3"><input type="checkbox" name="useColours" /> I know the text and background colours</label>
              <div className="space-y-1"><Label htmlFor="textColour">Text colour</Label><Input id="textColour" name="textColour" type="color" defaultValue="#ffffff" className="h-9 p-1" /></div>
              <div className="space-y-1"><Label htmlFor="bgColour">Background colour</Label><Input id="bgColour" name="bgColour" type="color" defaultValue="#1b2a4a" className="h-9 p-1" /></div>
              <label className="flex items-center gap-2 self-end"><input type="checkbox" name="largeText" value="true" /> Large text (18pt+)</label>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Without these, INKLOOM estimates contrast from the image&apos;s main colours (medium confidence).</p>
          </details>
        </TabsContent>
        <TabsContent value="url" className="space-y-2 pt-4">
          <Label htmlFor="url">Web address</Label>
          <Input id="url" name="url" type="url" placeholder="https://example.com/launch" required={source === "url"} />
          <p className="text-xs text-muted-foreground">Public pages only. Internal or private network addresses are refused.</p>
        </TabsContent>
      </Tabs>

      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        How your content is used: rule checks run on our server. When AI review is on, the content (with emails and phone numbers masked) and the
        relevant public brand rules are sent to our Azure AI Foundry deployment. Internal facts and codenames are never sent. Every AI finding is labelled.
      </p>

      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button type="submit" disabled={busy}>{busy ? "Auditing…" : item ? "Upload new version and audit" : "Audit content"}</Button>
    </form>
  );
}
