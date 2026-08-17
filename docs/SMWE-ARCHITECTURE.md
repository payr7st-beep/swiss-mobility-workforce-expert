# SMWE — Application Architecture

**Date:** 2026-08-17 | **Status:** Design phase — mirroring SPE Phase 2 architecture  
**Stack:** Azure App Service · Azure SQL Database (VECTOR type) · Microsoft Entra External ID (CIAM) · multilingual embeddings  

Companion to `SMWE-SOURCE-REGISTER-2026.md`, `SMWE-MONETIZATION-SPEC.md`. SMWE is the third member of the Swiss Compliance Expert Suite (SPE | SPC | SMWE).

---

## 1. Principle — one core, two doors (inherits SPE architecture)

A single **retrieval core** (`services/retrieval.js`) turns a query into ranked, cited chunks. Two entrypoints:

- **Web door** (`routes/ask.js`) — credit-metered, Entra External ID auth, public product.
- **MCP door** (`mcp/server.js`) — read-only tools for the SevenSprings agent roster (Hermes), gated by internal shared secret, not the SaaS credit ledger.

The MCP door exposes three tools:
- `smwe_lookup` — semantic search over SMWE knowledge corpus
- `smwe_treaty` — specific treaty/agreement lookup (country pair + question)
- `smwe_permit` — permit type determination (nationality + scenario → permit category)

SMWE registers in the SPE orchestrator's `sip_agent_registry` as agent `SMWE` with domains: `['immigration', 'global_mobility', 'cross_border', 'social_security', 'dta']`.

---

## 2. Components

| File | Role |
|---|---|
| `lib/chunker.js` | Markdown → chunks (Art./treaty/circular citations, permit codes) |
| `migrations/001_smwe_chunks.sql` | Azure SQL `smwe_chunks` (VECTOR(1024)) + `smwe_ingest_runs` |
| `services/retrieval.js` | Core: `retrieve`/`getTreaty`/`getPermit` via `VECTOR_DISTANCE('cosine', ...)` |
| `services/embeddings.js` | Multilingual (bge-m3; hf/ollama/openai/voyage) — shared with SPE |
| `scripts/ingest.js` | Chunk → embed → upsert → register run |
| `middleware/authExternal.js` | Entra External ID token validation |
| `services/creditService.js` | Credit ledger (shared with SPE) |
| `routes/ask.js` | Web door: classify C0/C1/C2/C3, meter, retrieve, cited response |
| `mcp/server.js` | MCP server (stdio + streamable-HTTP): `smwe_lookup`, `smwe_treaty`, `smwe_permit` |
| `services/gapDetector.js` | Gap detection from query log (inherited from SPE, SMWE domain pivots) |
| `services/orchestrator.js` | Intent classifier (SMWE-specific keywords) + agent dispatcher |

---

## 3. Query Classes & Credits

| Class | Description | Path | Credits |
|---|---|---|---|
| C0 | Exact lookup (permit name, treaty country, quota number) | Retrieval, no LLM | 1 |
| C1 | Single-domain question (A1 process, G permit conditions) | RAG 1 module + mid-tier model | 2 |
| C2 | Cross-domain advisory (assignment: social security + DTA + permit) | RAG multi-module + frontier model | 5 |
| C3 | Document analysis (review assignment letter, permit decision) | Frontier + long context | 10 |

---

## 4. SMWE Intent Keyword Map (orchestrator)

```javascript
const INTENT_KEYWORDS_SMWE = {
  IMMIGRATION: [
    'ausweis', 'aufenthaltsbewilligung', 'bewilligung', 'permit', 'permis', 'autorisation',
    'b-ausweis', 'c-ausweis', 'l-ausweis', 'g-ausweis', 'grenzgänger', 'frontalier',
    'sem', 'migrationsamt', 'einreise', 'visum', 'vise', 'visa',
    'kontingent', 'quota', 'aig', 'vzae', 'afmp', 'fza', 'lsee',
    'drittstaatsangehöriger', 'ressortissant pays tiers', 'third country national',
    'familiennachzug', 'regroupement familial', 'family reunification',
  ],
  GLOBAL_MOBILITY: [
    'entsendung', 'assignment', 'expatriate', 'expat', 'detachement', 'détachement',
    'shadow payroll', 'split payroll', 'schattenabrechnung',
    'schattenlohnabrechnung', 'aufspaltung lohn',
    'arbeitsortswechsel', 'versetzung', 'mutation', 'relocation',
    'home office abroad', 'homeoffice ausland', 'bureau maison étranger',
    'working day tracking', 'arbeitstageerfassung', 'suivi jours travail',
    'intracompany transfer', 'konzernintern',
  ],
  CROSS_BORDER: [
    'grenzgänger', 'frontalier', 'lavoratore frontaliero', 'cross-border',
    'grenzpendler', 'pendler', 'télétravail', 'homeoffice', 'home-office',
    'grenzgängerstatus', 'statut frontalier',
    'deutschland grenze', 'frankreich grenze', 'italien grenze',
    'frankreich homeoffice', 'deutschland homeoffice', 'italien homeoffice',
    '40 prozent', '25 prozent', '49 prozent',
  ],
  SOCIAL_SECURITY: [
    'a1', 'a1-bescheinigung', 'formulaire a1', 'attestation a1',
    'sozialversicherungsabkommen', 'accord securite sociale', 'bilateral agreement',
    'verordnung 883', 'regulation 883', 'reglement 883',
    'certificate of coverage', 'entsandte', 'posted worker',
    'mehrstaatentätigkeit', 'activité multi-états', 'multi-state',
    'zas', 'bsv', 'ofas', 'svz', 'ahv international', 'avs international',
    'alps', 'ausgleichskasse international',
  ],
  DTA: [
    'doppelbesteuerungsabkommen', 'dba', 'dta', 'accord fiscal', 'abkommen',
    'doppelbesteuerung', 'double imposition', 'double taxation',
    'art 15', 'artikel 15', 'article 15', '183 tage', '183 jours', '183 days',
    'steueransässigkeit', 'résidence fiscale', 'tax residence',
    'quellensteuer international', 'quellenbesteuerung', 'retenue source',
    'treaty relief', 'freistellungsmethode', 'anrechnungsmethode',
    'sif', 'estv dta', 'oecd modell',
  ],
};
```

---

## 5. Gap Detection — SMWE Domain Pivots

The SMWE gap detector inherits `gapDetector.js` from SPE, extended with SMWE-specific domain pivots:

```javascript
const SMWE_DOMAIN_PIVOTS = [
  'a1', 'grenzgänger', 'frontalier', 'entsendung', 'assignment',
  'shadow payroll', 'split payroll', 'homeoffice ausland',
  'dba', 'doppelbesteuerung', '183 tage', 'steueransässigkeit',
  'bewilligung', 'permit', 'sem', 'vzae', 'aig',
  'sozialversicherungsabkommen', 'zas', 'bsv',
  'verordnung 883', 'posted worker', 'entsandte',
];
```

---

## 6. Data Protection

`smwe_chunks` holds only published regulatory text + embeddings. No personal employee data, no immigration case files, no individual tax details. Consistent with nDSG / GDPR data minimisation principle.

---

## 7. Agent Registry Entry (for SPE orchestrator)

```json
{
  "agent_id": "SMWE",
  "agent_name": "Swiss Mobility & Workforce Expert",
  "mcp_endpoint": "https://smwe-api.azurewebsites.net/mcp",
  "domains": ["immigration", "global_mobility", "cross_border", "social_security", "dta"],
  "capabilities": ["semantic_search", "treaty_lookup", "permit_classification"]
}
```

---

## 8. Copilot Studio Deployment (parallel channel)

The SMWE also operates as a **Microsoft Copilot Studio declarative agent** for the Microsoft 365 Copilot ecosystem. The `declarativeAgent.json` and `manifest.json` files describe this deployment. The Copilot Studio channel uses the same knowledge base but accesses it via SharePoint-hosted documents rather than the Azure SQL vector store.

**Copilot Studio knowledge sources:**
- SMWE-KB-01-Immigration.md (SharePoint)
- SMWE-KB-02-GlobalMobility.md (SharePoint)
- SMWE-KB-03-CrossBorder.md (SharePoint)
- SMWE-KB-04-SocialSecurity.md (SharePoint)
- SMWE-KB-05-DTAs.md (SharePoint)

---

*SMWE-ARCHITECTURE | SevenSprings Technology AG | v1.0 | 2026-08-17*
