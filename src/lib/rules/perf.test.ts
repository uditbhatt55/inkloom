import { it } from "vitest";
import { MARKETING_EN, checkRulePack } from "./rulepack";
it("perf", () => {
  const text = "Northbeam Sync keeps your files in step across devices, with 99.9% monthly uptime. ".repeat(3600);
  let total = 0;
  for (const r of MARKETING_EN) { const t = performance.now(); checkRulePack(text, [r]); const d = performance.now() - t; total += d; if (d > 15) console.log("RULE", r.code, d.toFixed(0), "ms"); }
  console.log("TOTAL", total.toFixed(0), "ms");
});
