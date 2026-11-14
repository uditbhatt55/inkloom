import type { Message } from "./prompt";
import type { AiEnv } from "./select";

export type JsonRequest = { messages: Message[]; name: string; schema: object };
export type AiJson = { model: string; call(req: JsonRequest): Promise<unknown> };

/**
 * One structured-output call for helper tasks that are not an audit (clause rewrite, clause-pair conflicts).
 * Same endpoint, key header and budget as the audit reviewer (src/lib/ai/reviewer.ts); returns the model's raw JSON,
 * unchecked: callers validate it, and nothing the model returns is ever saved without a person confirming it.
 */
export function azureJson(
  cfg: { endpoint: string; apiKey: string; deployment: string; timeoutMs?: number },
  fetchImpl: typeof fetch = fetch,
): AiJson {
  return {
    model: cfg.deployment,
    async call({ messages, name, schema }) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs ?? 45_000);
      try {
        const res = await fetchImpl(`${cfg.endpoint.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", "api-key": cfg.apiKey },
          body: JSON.stringify({ model: cfg.deployment, messages, response_format: { type: "json_schema", json_schema: { name, strict: true, schema } } }),
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

/** The real model only when demo mode is off and endpoint, key and deployment are set (same rule as chooseReviewer); otherwise null. */
export function chooseAiJson(env: AiEnv = process.env as AiEnv): AiJson | null {
  const demo = (env.DEMO_MODE ?? "true").toLowerCase() !== "false";
  const { AZURE_OPENAI_ENDPOINT: endpoint, AZURE_OPENAI_API_KEY: apiKey, AZURE_DEPLOYMENT_DEFAULT: deployment } = env;
  return !demo && endpoint && apiKey && deployment ? azureJson({ endpoint, apiKey, deployment }) : null;
}
