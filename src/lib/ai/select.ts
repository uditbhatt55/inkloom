import { azureReviewer, sha256, simulatedReviewer, type AiReviewer } from "@/lib/ai/reviewer";
import northbeamPost from "@/lib/ai/recordings/northbeam-post.json";

/** Hand-checked demo recordings (§7.6), keyed by the sha256 of the exact submitted content. */
const RECORDINGS: { content: string; response: unknown }[] = [northbeamPost];
export const DEMO_RECORDINGS: Record<string, unknown> = Object.fromEntries(RECORDINGS.map((r) => [sha256(r.content), r.response]));

export type AiEnv = {
  DEMO_MODE?: string; AZURE_OPENAI_ENDPOINT?: string; AZURE_OPENAI_API_KEY?: string;
  AZURE_DEPLOYMENT_DEFAULT?: string;
};

/**
 * Real Azure review only when demo mode is off AND endpoint, key and deployment are all set.
 * Otherwise the simulated reviewer: recordings for the seeded documents, "AI checks skipped" for anything else.
 * Never throws, so a missing key can't break an upload.
 */
export function chooseReviewer(env: AiEnv = process.env as AiEnv): AiReviewer {
  const demo = (env.DEMO_MODE ?? "true").toLowerCase() !== "false";
  const { AZURE_OPENAI_ENDPOINT: endpoint, AZURE_OPENAI_API_KEY: apiKey, AZURE_DEPLOYMENT_DEFAULT: deployment } = env;
  if (!demo && endpoint && apiKey && deployment) return azureReviewer({ endpoint, apiKey, deployment });
  return simulatedReviewer(DEMO_RECORDINGS);
}
