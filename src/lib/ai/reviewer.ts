import { createHash } from "node:crypto";
import { AI_JSON_SCHEMA } from "./schema";
import type { Message } from "./prompt";

export type AiRequest = { messages: Message[]; content: string };
/**
 * review() resolves with the model's raw JSON (unchecked), null when there is nothing to run (demo mode without a recording),
 * and throws on network/HTTP failure. The pipeline validates the shape and falls back to rule-only results.
 */
export type AiReviewer = { mode: "real" | "simulated"; model: string; review(req: AiRequest): Promise<unknown | null> };

export type AzureConfig = { endpoint: string; apiKey: string; deployment: string; timeoutMs?: number };

/** Azure OpenAI v1 endpoint, e.g. https://<resource>.openai.azure.com/openai/v1. The key is sent only in the api-key header. */
export function azureReviewer(cfg: AzureConfig, fetchImpl: typeof fetch = fetch): AiReviewer {
  return {
    mode: "real",
    model: cfg.deployment,
    async review({ messages }) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs ?? 25_000);
      try {
        // shortcut: no temperature set (support differs per model); add it if the eval shows unstable results.
        const res = await fetchImpl(`${cfg.endpoint.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", "api-key": cfg.apiKey },
          body: JSON.stringify({
            model: cfg.deployment,
            messages,
            response_format: { type: "json_schema", json_schema: { name: "audit_findings", strict: true, schema: AI_JSON_SCHEMA } },
          }),
          signal: ctl.signal,
        });
        if (!res.ok) throw new Error(`Azure OpenAI returned HTTP ${res.status}`);
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = data.choices?.[0]?.message?.content;
        if (typeof text !== "string") throw new Error("Azure OpenAI response had no message content");
        return JSON.parse(text);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Demo mode (proposal §7.6): hand-checked recordings keyed by the sha256 of the submitted content.
 * No recording -> null, so the pipeline reports "AI judgement checks skipped" and still runs every rule for real.
 */
export function simulatedReviewer(recordings: Record<string, unknown>): AiReviewer {
  return { mode: "simulated", model: "simulated", review: async ({ content }) => recordings[sha256(content)] ?? null };
}
