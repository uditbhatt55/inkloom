import type { Finding } from "@/lib/audit/types";

/**
 * ASCI "Guidelines for Responsible Labelling of Synthetically Generated Content in Advertising" (17 Sept 2026, in force
 * three months after publication). Round 3, improvement 1. Rules are our own wording; each cites the clause it follows.
 * The copy can only show what the text says, so these are signals for the reviewer (medium confidence), not proof:
 * a picture made with AI that the text never mentions is not seen here.
 * shortcut: English phrases only; clause 1B/1C (exaggerated results, non-existent places) need the visual, not the text.
 */
const SOURCE = "ASCI Guidelines for Responsible Labelling of Synthetically Generated Content in Advertising (Sept 2026)";

/** A disclosure already in the copy: "created/enhanced/generated using AI", "#AIgenerated", "(AI-generated)" and the like. */
const LABEL = /\b(?:created|generated|enhanced|made|produced|altered)\s+(?:using|with|by)\s+(?:AI|artificial intelligence)\b|#(?:AIgenerated|madewithAI|AIart)\b|\(\s*AI[- ]generated\s*\)|\bAI[- ]generated (?:content|image|video|visual|voice|influencer|avatar)s?\s*(?:[.)]|$)/i;
const SPONSOR_LABEL = /\bsponsored by\b/i;

type Rule = { code: string; pattern: RegExp; needs: "label" | "sponsor" | null; severity: Finding["severity"]; explanation: string; suggestion: string };

export const ASCI_SGC_RULES: Rule[] = [
  {
    code: "ASCI-SGC-PROHIBITED", needs: null, severity: "major",
    pattern: /\bdeep\s?fakes?\b|\b(?:AI[- ]generated|synthetic|AI[- ]created)\s+(?:testimonials?|reviews?|endorsements?|customer stories)\b/gi,
    explanation: "ASCI clause 1A/1D: an AI-made testimonial or endorsement presented as real, or a deepfake or someone's likeness used without consent, breaks the ASCI Code even with an AI label.",
    suggestion: "Use only real, verifiable testimonials, and written consent for any real person's likeness or voice.",
  },
  {
    code: "ASCI-SGC-LABEL", needs: "label", severity: "major",
    pattern: /\b(?:virtual|AI|synthetic|CGI)[- ](?:influencers?|ambassadors?|brand ambassadors?|presenters?|spokespersons?|avatars?)\b|\bdigital avatars?\b|\bdigital (?:twins?|replicas?|doubles?)\b|\b(?:cloned|synthetic|AI[- ]generated)\s+voices?\b|\bvoice[- ]clon(?:e|es|ed|ing)\b|\bdigitally (?:recreated|replicated|generated)\b|\b(?:3D|CGI|computer[- ]generated)\s+(?:render(?:ing)?s?|models?|walkthroughs?|tours?)\b|\bartist'?s impressions?\b/gi,
    explanation: "ASCI clause 2: a synthetic influencer or ambassador, a replicated face or voice (even with consent), or a demonstration of something that does not exist yet must carry a clear label such as \"Video created using AI\". No such label was found in this text.",
    suggestion: "Add a clear label next to it, e.g. \"Video created using AI\" or \"Image enhanced using AI\".",
  },
  {
    // minor: the text cannot show whether the recommendation was paid for, only that an AI makes one
    code: "ASCI-SGC-SPONSORED", needs: "sponsor", severity: "minor",
    pattern: /\b(?:our |the )?AI(?:[- ](?:assistant|chatbot|bot|stylist|advisor|adviser|concierge))?\s+recommends\b|\bAI[- ]recommended\b|\brecommended by (?:our |the )?AI\b/gi,
    explanation: "ASCI clause 2F: when an AI recommends a product because the brand paid for it, the recommendation must say \"Sponsored by [Brand]\". No such words were found in this text; check whether this recommendation is paid for.",
    suggestion: "If the recommendation is paid for, add \"Sponsored by [Brand]\" next to it.",
  },
];

/** `disabled` holds rule codes an organisation has switched off (the same list as the wording pack's). */
export function checkAsciSgc(text: string, disabled: ReadonlySet<string> = new Set()): Finding[] {
  const labelled = LABEL.test(text);
  const sponsored = SPONSOR_LABEL.test(text);
  const out: Finding[] = [];
  for (const r of ASCI_SGC_RULES) {
    if (disabled.has(r.code) || (r.needs === "label" && labelled) || (r.needs === "sponsor" && sponsored)) continue;
    for (const m of text.matchAll(r.pattern)) {
      out.push({
        quote: m[0], start: m.index!, end: m.index! + m[0].length,
        category: "claim", severity: r.severity, confidence: "medium", source: "rule", ruleCode: r.code,
        explanation: `${r.explanation} Source: ${SOURCE}.`, suggestion: r.suggestion, status: "open", label: null,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
