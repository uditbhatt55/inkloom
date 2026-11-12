import { parseDocument } from "yaml";
import type { Term } from "./terms";

/** Import one Vale rule file; codes are unique within the returned term list. */
export function importVale(yaml: string): { terms: Term[]; warnings: string[] } {
  const terms: Term[] = [];
  const warnings: string[] = [];
  let rule: unknown;
  try {
    const document = parseDocument(yaml);
    if (document.errors.length) {
      return { terms, warnings: ["Malformed Vale YAML: " + document.errors[0].message] };
    }
    rule = document.toJS({ mapAsMap: true });
  } catch {
    return { terms, warnings: ["Unable to read Vale YAML."] };
  }

  if (!(rule instanceof Map)) {
    return { terms, warnings: ["Vale rule has no usable tokens."] };
  }

  const type: unknown = rule.get("extends");
  const name = typeof rule.get("name") === "string" ? rule.get("name") : String(type ?? "unnamed");
  if (type !== "substitution" && type !== "existence") {
    return { terms, warnings: [`Skipped Vale rule "${name}": unsupported rule type "${String(type)}".`] };
  }

  const add = (term: string, kind: Term["kind"], replacement: string | null) => {
    terms.push({ code: `VALE-${String(terms.length + 1).padStart(3, "0")}`, term, kind, replacement });
  };
  const usable = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

  if (type === "substitution") {
    const swap: unknown = rule.get("swap");
    if (swap instanceof Map) {
      for (const [banned, preferred] of swap) {
        if (usable(banned) && usable(preferred)) {
          add(banned, "banned", preferred);
          add(preferred, "preferred", null);
        } else {
          warnings.push(`Vale rule "${name}": skipped an unusable substitution.`);
        }
      }
    }
  } else {
    const tokens: unknown = rule.get("tokens");
    if (Array.isArray(tokens)) {
      for (const token of tokens) {
        if (usable(token)) add(token, "banned", null);
        else warnings.push(`Vale rule "${name}": skipped an unusable token.`);
      }
    }
  }

  if (!terms.length) warnings.push(`Vale rule "${name}" has no usable tokens.`);
  return { terms, warnings };
}
