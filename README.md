# Swiss Mobility & Workforce Expert (SMWE)

**Declarative AI agent for Microsoft Copilot Studio**  
*A SevenSprings Technology AG product — sibling to Swiss Payroll Expert (SPE) and Swiss Professional Companion (SPC)*

---

## Overview

SMWE is a declarative AI agent that provides compliance guidance and regulatory interpretation for Swiss immigration, global mobility, cross-border workforce management, and social security coordination. It is built on the same architecture as SPE, using Microsoft Copilot Studio, Azure App Service, and Azure SQL with native vector search.

SMWE does **not** provide legal opinions, immigration filings, tax filings, or recruitment services. All outputs carry a mandatory disclaimer and are subject to expert sign-off before being considered production-ready.

---

## Service Domains

| Domain | Code | Scope |
|--------|------|-------|
| Immigration | D05 / IMM-001–008 | Permit classification, EU/EFTA vs TCN tracks, quota monitoring |
| Global Mobility | D06 / GM-001–010 | Assignment categories, A1/CoC, shadow payroll, PE risk |
| Workforce Compliance | D07 / WC-001–008 | OR, ArG, CLAs (84 extended), employee participation |
| Staffing Advisory | D08 / WSC-001–008 | Staffing law, AVG compliance (read-only guidance) |
| External Expert Network | D10 / EXT-001–204 | Referrals: immigration lawyers, tax advisors, fiduciaries |

---

## Architecture

- **Copilot Studio channel** — declarative agent (`declarativeAgent.json` v1.4 + Teams manifest v1.20)
- **API channel** — Azure App Service (Node.js 20 LTS), Azure SQL VECTOR(1024), Entra External ID CIAM
- **MCP tools** — `smwe_lookup`, `smwe_treaty`, `smwe_permit`
- **RAG pipeline** — bge-m3 multilingual embeddings, chunker, ingest scripts
- **Gap detection** — `gapDetector.js` with SMWE domain pivots; `smwe_gap_signals` / `smwe_query_log` tables
- **Credit model** — C0 (1 cr) / C1 (2 cr) / C2 (5 cr) / C3 (10 cr)

---

## Repository Structure

```
SMWE/
├── copilot-studio/
│   ├── declarativeAgent.json     # Copilot Studio manifest v1.4
│   ├── manifest.json             # Teams app manifest v1.20
│   └── system-prompt.md          # Agent system prompt
├── knowledge-base/
│   ├── SMWE-KB-01-Immigration.md
│   ├── SMWE-KB-02-GlobalMobility.md
│   ├── SMWE-KB-03-CrossBorder.md
│   ├── SMWE-KB-04-SocialSecurity.md
│   └── SMWE-KB-05-DTAs.md
├── docs/
│   ├── SMWE-ARCHITECTURE.md
│   ├── SMWE-MONETIZATION-SPEC.md
│   ├── SMWE-RULESET-1-EU883.md
│   ├── SMWE-RULESET-2-PERMIT.md
│   ├── SMWE-SOURCE-REGISTER-2026.md
│   └── content-policy.md
├── update-mechanism/
│   └── SMWE-UPDATE-FRAMEWORK.md
├── social-media/
│   └── SMWE-SOCIAL-MEDIA-STRATEGY.md
├── SMWE-Master-Spec.html          # Interactive master specification
└── README.md
```

---

## Legal Notice

> This output is indicative and must be confirmed with the competent authority. SMWE does not provide legal advice, tax advice, or immigration filing services.

All rule sets carry `reviewed: false` until a qualified Immigration Lawyer, Global Mobility Expert, or Swiss fiduciary (Treuhänder) has signed off with name, credentials, and date.

---

## Status

| Component | Status |
|-----------|--------|
| Copilot Studio manifest | v1.0 — ready for deployment |
| Knowledge Base (KB-01 to KB-05) | v1.0 — pending expert sign-off |
| Rule Sets (RS-1 EU883, RS-2 Permit) | v1.0 — pending sign-off |
| Node.js backend scaffolding | Planned — Phase B |
| Azure SQL migrations | Planned — Phase B |
| AppSource submission | Planned — Phase C |

---

*SMWE v1.0 | SevenSprings Technology AG | Effective 1 August 2026 | Next review 1 November 2026*
