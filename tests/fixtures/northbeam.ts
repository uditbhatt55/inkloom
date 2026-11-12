import type { Knowledge } from "@/lib/ai/brandpack";

/** Small fictional knowledge base used by integration tests (the full demo org comes from ChatGPT Prompt 1). */
export const northbeam: Knowledge = {
  clauses: [
    { code: "CLAIM-02", category: "claim", text: "Do not describe service levels as guaranteed; refer to the SLA.", status: "active" },
    { code: "TONE-01", category: "tone", text: "Keep a professional tone; no slang.", status: "active" },
    { code: "CLAIM-09", category: "claim", text: "Draft rule that must not be cited.", status: "draft" },
  ],
  facts: [
    { code: "FACT-07", statement: "Northbeam Sync SLA: 99.9% monthly uptime", validFrom: "2026-04-01", validUntil: "2027-03-31", visibility: "public" },
    { code: "FACT-05", statement: "Northbeam Vault starts at INR 499 per month", validFrom: "2025-01-01", validUntil: "2026-06-30", visibility: "public" },
    { code: "FACT-90", statement: "Internal target: 12000 customers by Q3", validFrom: null, validUntil: null, visibility: "internal" },
  ],
  terms: [
    { code: "TERM-01", term: "Northbeam Sync", kind: "preferred", replacement: null },
    { code: "TERM-02", term: "NB Sync", kind: "banned", replacement: "Northbeam Sync" },
    { code: "TERM-31", term: "Project Atlas", kind: "internal", replacement: null },
  ],
};

export const TODAY = "2026-11-12";
