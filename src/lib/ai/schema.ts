import { z } from "zod";
import { CATEGORIES, CONFIDENCES, SEVERITIES } from "@/lib/audit/types";

/** Runtime check of what the model returned. The validator then checks the findings against the content and the knowledge base. */
export const AiOutputSchema = z.object({
  findings: z.array(
    z.object({
      quote: z.string(),
      start: z.number().int(),
      end: z.number().int(),
      category: z.enum(CATEGORIES),
      severity: z.enum(SEVERITIES),
      confidence: z.enum(CONFIDENCES),
      ruleId: z.string().nullable(),
      explanation: z.string().min(1),
      suggestion: z.string().nullable(),
    }),
  ),
});
export type AiOutput = z.infer<typeof AiOutputSchema>;

/** Same shape as a strict JSON Schema for Azure Structured Outputs (all keys required, no extra keys). */
export const AI_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["quote", "start", "end", "category", "severity", "confidence", "ruleId", "explanation", "suggestion"],
        properties: {
          quote: { type: "string" },
          start: { type: "integer" },
          end: { type: "integer" },
          category: { type: "string", enum: [...CATEGORIES] },
          severity: { type: "string", enum: [...SEVERITIES] },
          confidence: { type: "string", enum: [...CONFIDENCES] },
          ruleId: { type: ["string", "null"] },
          explanation: { type: "string" },
          suggestion: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;
