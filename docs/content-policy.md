# Content Policy

## SaaS neutrality (mandatory)

This platform is a SaaS product for a global audience. No code, comment,
documentation, test fixture, seed data, or example may reference any real
individual, family, employer, or business situation.

All examples and test data MUST use neutral, generic, non-identifying values:
- Generic ISO country codes used purely as data (e.g. CH, DE, FR) with no
  narrative tying them to any real person or case
- Placeholder company names (e.g. "Example AG", "Test Company GmbH")
- Placeholder permit numbers and identifiers
- Placeholder employee scenarios with no identifying characteristics

This applies to every contributor and every automated tool that writes to this repository.

## Determination rules

- All determination logic is deterministic and rule-based. No AI decides immigration or
  legal outcomes at runtime.
- Rule sets are sourced from authoritative legal references and cited at the article level.
- Each rule set carries a review status. It is not considered production-ready for real
  determinations until a qualified Immigration Lawyer, Global Mobility Expert, or
  Swiss fiduciary (Treuhänder) has signed off, at which point its `reviewed` flag is
  set with a name, credentials, and date.
- Every response includes a disclaimer: "This output is indicative and must be confirmed
  with the competent authority. SMWE does not provide legal advice, tax advice, or
  immigration filing services."

## Legal boundary (mandatory)

SMWE provides:
- Compliance guidance
- Regulatory interpretation
- Decision support

SMWE does NOT provide:
- Legal opinions or immigration filings (→ refer to EXT-102 Immigration Lawyer)
- Tax opinions or tax return preparation (→ refer to EXT-003 International Tax Advisor)
- Employee placement, staffing, or recruitment services (AVG-regulated; requires licence)
- Payroll calculations (→ refer to SPE)

## Legal sources

Swiss and EU legislation is freely reproducible:
- Swiss legislation: Swiss URG Art. 5 excludes official texts from copyright; Fedlex publications
  are freely usable
- EU legislation: EU reuse policy permits reproduction of EUR-Lex texts; CELEX numbers cited

The app may bundle and cite raw statutory text. Proprietary commentary and third-party
annotated/translated editions are NOT reproduced.

## Data protection

No personal data (immigration case data, individual salary, employee records, tax filings)
is stored in the SMWE knowledge base or vector store. The smwe_chunks table holds only
published regulatory text and embeddings. smwe_customers holds identity and credit
accounting only. Consistent with nDSG (Swiss new Data Protection Act) and GDPR
data minimisation principle.
