# Azure models — research summary (ChatGPT Deep Research, 12 Nov 2026)

Checked by Claude: arithmetic re-done and correct. Links not opened.

## Prices (Global Standard, short context, USD per 1M tokens)
| Model | Input | Cached input | Cache write | Output |
|---|---|---|---|---|
| gpt-6-luna | 0.10 | 0.01 | 0.125 | 0.50 |
| gpt-6.1-sol | 2.00 | 0.10 | 2.50 | 10.00 |

Long context costs more (Luna 0.20 / 0.02 / 0.75; Sol 4 / 0.20 / 15).
Sources (primary): Azure blog 22 Sep 2026 (GPT-6 Astra, Sol, Luna); Foundry blog 29 Sep 2026 (GPT-6.1 Sol).

## Cost per audit (1,000 new input + 2,000 cached + 1,200 output tokens; ₹93.8075 = $1, RBI 11 Nov 2026)
- Luna: $0.00072 ≈ **₹0.07**
- Sol: $0.0142 ≈ **₹1.33**
- Excludes cache-write on first call, image tokens, retries, tax.

## Capabilities
Both: Structured Outputs ✔, image input ✔, context 1,050,000, **max input 922,000**, max output 128,000. No retirement date announced.

## ✅ Our actual quota (checked 12 Nov 2026, Foundry → Manage → Quota, subscription "Azure for Students")
| Model | Scope | Type | Available |
|---|---|---|---|
| gpt-6-luna | Global | Global Standard | **250K TPM** (0 used) |
| gpt-6.1-sol | Global | Global Standard | **250K TPM** (0 used) |
| gpt-6.1-sol | APAC Data Zone | Data Zone Standard | 100K TPM |

= Tier 1 level. Enough for the hackathon (an audit is ~4K tokens → ~60 audits/minute). Nothing deployed yet — deploy both on build-window day one.
Existing project: `proj-default` (resource `Uditfoundry`, Central India).

## Quota — background (risk now resolved for us)
- Tier 0 (free-type subscriptions): **no quota** for either model, and can't request more.
- Tier 1: 250 RPM / 250K TPM. Tier 2: 1,000 RPM / 1M TPM. Tier depends on subscription; Azure for Students is **not** guaranteed any tier.
- Q&A threads (Feb, Sep, Oct 2026): students saw 0 TPM, region limits, and approved quota that still didn't work (region/model mismatch). The "1K TPM for students" claim is an AI-generated answer — don't rely on it.
- Check: Foundry → project → Manage → Quota → find both models (Global Standard) → TPM > 0?
- Request: Manage → Quota → Request quota, or https://aka.ms/oai/stuquotarequest
- Fallback: Pay-As-You-Go subscription or university sponsorship. Demo mode keeps the product demonstrable regardless.

## Changes to the proposal / plan
1. Reference 35: cite the two Microsoft blog posts instead of AzureSpeed.
2. Reference 36: keep, add the Sep and Oct 2026 Q&A threads.
3. §9 "1M-token context": say "1.05M context, 922K max input".
4. Budget: 1,000 Luna audits ≈ ₹70; 1,000 Sol escalations ≈ ₹1,330.
