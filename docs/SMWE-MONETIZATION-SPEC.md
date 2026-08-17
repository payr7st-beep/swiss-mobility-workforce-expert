# SMWE — Monetization Specification

**Product:** Swiss Mobility & Workforce Expert (SMWE)  
**Date:** 2026-08-17 | **Status:** DRAFT — pricing to be confirmed by owner  
**Architecture:** Mirrors SPE-MONETIZATION-SPEC-v0.1 (shared Paddle MoR, Azure stack, credit model)  

---

## 1. Credit Model (inherits SPE design)

| Class | Description | Credits | Est. COGS |
|---|---|---|---|
| C0 | Exact lookup (quota number, treaty country status) | 1 | ~CHF 0.001–0.005 |
| C1 | Single-domain question (A1 process, G permit conditions) | 2 | ~CHF 0.01–0.03 |
| C2 | Cross-domain advisory (assignment: permit + A1 + DTA) | 5 | ~CHF 0.05–0.15 |
| C3 | Document analysis (assignment letter, permit decision, shadow payroll review) | 10 | ~CHF 0.15–0.40 |

---

## 2. Subscription Tiers

| Tier | Price (CHF/month) | Daily credits | Seats | Target user |
|---|---|---|---|---|
| Free | 0 | 5/day, C0–C1 only | 1 | Trial, lead-gen |
| Individual | 149/mo | 75/day, C0–C2 | 1 | Solo HR, solo GM specialist |
| Professional | 399/mo | 200/day, all classes | 1–5 | HR teams, fiduciaries |
| Team | 999/mo | 500/day, all classes | 6–25 | HR dept, law firms |
| Business | 1,999/mo | Pooled 1,200/day | 26–100 | Corporates, MNCs |
| Enterprise | Custom | Pooled, SLA | Unlimited | Large accounts, channel partners |

**Pricing note:** Individual CHF 149, Professional CHF 399, Team CHF 999, Business CHF 1,999 per drive file context (inputs file).

---

## 3. Top-Up Credit Packs

| Pack | Price (CHF) | Credits | Effective rate vs. Professional |
|---|---|---|---|
| Boost 50 | 8 | 50 | ~4× premium |
| Boost 200 | 24 | 200 | ~3.5× premium |
| Boost 500 | 49 | 500 | ~3× premium |

- Consumption order: subscription credits first, then pack credits
- Pack expiry: 90 days from purchase
- Free tier cannot buy packs for C2/C3 — upgrade prompt shown

---

## 4. Microsoft Marketplace Positioning

**Product family:** Swiss Compliance Expert Suite (SevenSprings Technology AG)
- Swiss Payroll Expert (SPE) — existing
- Swiss Professional Companion (SPC) — existing  
- **Swiss Mobility & Workforce Expert (SMWE) — NEW**

**Marketplace:** Microsoft AppSource / Teams Store
**Certification path:** Microsoft 365 Copilot extensibility certification + Teams App Validation

**Bundle pricing (cross-sell):**
- SPE + SMWE: 20% discount on second product
- SPE + SPC + SMWE (full suite): 30% discount

---

## 5. Consumption Controls (inherit SPE design)

1. **Ledger gate:** balance checked and atomically decremented BEFORE any LLM call
2. **Per-request ceilings:** C0: n/a, C1: 1k tokens, C2: 3k tokens, C3: 8k tokens
3. **Daily spend circuit breaker:** if actual cost > 2× expected cost → hard stop + alert
4. **Global daily budget governor:** platform-wide cap; soft-degrade at 90% (C2/C3 → mid-tier model)
5. **Retry policy:** max 1 automatic retry; idempotency key prevents double-debit
6. **Margin monitor:** nightly job per-user COGS/revenue; alert if >60%
7. **Abuse controls:** 10 req/min rate limit; auth required for C1+

---

## 6. Revenue Model at Scale

**Target 12-month MRR milestones:**
- Month 3: CHF 2,000 MRR (early adopters, direct)
- Month 6: CHF 8,000 MRR (marketplace launch)
- Month 12: CHF 25,000 MRR (suite cross-sell + Teams Shop)

**Key acquisition channels:**
- Microsoft Teams App Store
- Microsoft AppSource (commercial)
- LinkedIn (promoted via SPE/SPC existing following)
- SevenSprings channel partner network
- Global Mobility associations (SGMF, EMA, FIDI)

---

*SMWE-MONETIZATION-SPEC | SevenSprings Technology AG | v1.0 | 2026-08-17*
