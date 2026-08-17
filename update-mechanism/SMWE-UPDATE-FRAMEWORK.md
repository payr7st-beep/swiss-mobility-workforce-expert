# SMWE — Self-Learning & Update Framework

**Version:** 1.0 | **Date:** 2026-08-17  
**Mirrors:** SPE gapDetector.js + queryLogger.js architecture

---

## 1. Four-Layer Update Mechanism (matching SPE/SPC)

### Layer 1: Real-Time Gap Detection (gapDetector.js)

Continuously monitors query logs for questions that received low-quality or no-answer responses.

**How it works:**
1. Every query is logged to `smwe_query_log` with a retrieval quality score
2. Queries with `gap_flagged = 1` (retrieval score < threshold) accumulate
3. Every 24 hours, `gapDetector.js` runs and clusters flagged queries into topic clusters
4. Clusters with `signal_count >= 2` are written to `smwe_gap_signals`
5. Admin dashboard surfaces top 10 open gap signals for knowledge-base authoring

**SMWE domain pivots for gap clustering:**
```
a1, grenzgänger, frontalier, entsendung, assignment,
shadow payroll, split payroll, homeoffice ausland,
dba, doppelbesteuerung, 183 tage, steueransässigkeit,
bewilligung, permit, sem, vzae, aig,
sozialversicherungsabkommen, zas, bsv,
verordnung 883, posted worker, entsandte
```

**Invocation:**
- Automatically via GitHub Actions cron (daily at 01:00 CET)
- Manually: `node services/gapDetector.js`
- Via API: `POST /api/admin/gap-detect` (admin-only)

---

### Layer 2: Regulatory Change Monitoring

**Monthly quick-check sources:**
- SEM (sem.admin.ch): immigration law changes, new SEM directives, quota adjustments
- SECO (seco.admin.ch): posted worker rules, CLA updates, new extended CLAs
- BSV/OFAS (bsv.admin.ch): social security agreement changes, A1 procedure updates
- ZAS (zas.admin.ch): bilateral agreement status changes
- SIF (sif.admin.ch): new or amended DTAs
- ESTV (estv.admin.ch): new circulars, QST updates, equity tax guidance

**Watch list — high-change-frequency items:**
| Topic | Monitor | Frequency |
|---|---|---|
| Swiss immigration quotas | SEM + Fragomen | Annual (October/November for next year) |
| New bilateral social security agreements | ZAS | Quarterly |
| DTA ratifications | SIF | Quarterly |
| CLA extensions (AVE/AVEG) | SECO | 1 January and 1 July |
| Cross-border telework agreements | SIF/BSV | Ad hoc (key countries: FR, DE, IT) |
| ESTV circulars | ESTV | Ad hoc |
| SEM permit quota releases | SEM | Quarterly (UK) / Annual (others) |

---

### Layer 3: Quarterly Knowledge Base Review

**Process:**

**Step 1: Source scan** (Week 1 of each quarter)
- Pull update digest from all monitored sources
- Flag any changes since last knowledge-base version

**Step 2: Content update** (Week 2)
- Draft updated knowledge-base module sections
- Tag changes with effective date and source citation

**Step 3: Expert review** (Week 3)
- Subject matter expert (immigration specialist / global mobility expert) reviews changes
- Expert confirms accuracy and completeness
- Sign-off recorded in SMWE-SOURCE-REGISTER with name, date, credentials

**Step 4: Version increment and deployment** (Week 4)
- Knowledge base version incremented (e.g. v1.0 → v1.1)
- Updated files uploaded to SharePoint (Copilot Studio channel)
- Updated files ingested to Azure SQL vector store (web/MCP channel)
- Gap signals resolved for covered topics
- Release note published

**Quarterly review cadence:**
| Quarter | Review date | Focus areas |
|---|---|---|
| Q4 2026 | 1 November 2026 | 2027 quotas announcement; year-end DTA changes |
| Q1 2027 | 1 February 2027 | 1 January effective dates (DBG, AIG, VZAE); new CLAs |
| Q2 2027 | 1 May 2027 | Spring regulatory cycle |
| Q3 2027 | 1 August 2027 | 1 July effective dates; mid-year CLA updates |

---

### Layer 4: Annual Major Refresh

**Scope:**
- Complete review of all knowledge base modules against current-year legal sources
- Update all rate tables, quota figures, threshold values
- Benchmark against competitor knowledge bases and academic sources
- Fiduciary/expert sign-off on all modules
- Major version increment (e.g. v1.x → v2.0)

**Annual effective dates to track:**
- **1 January:** DBG, AHVG, BVG figures; many Fedlex statutes; DTA treaty changes
- **1 July:** Second-cycle Fedlex changes; CLA extensions
- **1 August:** SECO CLA status update (confirmed for 2026)

---

## 2. User Feedback Collection

### In-product feedback signals
- 👍 / 👎 thumbs reaction on each SMWE response
- Free-text comment option on 👎 (optional)
- All feedback events logged to `smwe_feedback` table

### Feedback routing
- 👍 → logged; used for quality scoring
- 👎 + comment → routed to knowledge gap review queue
- 👎 without comment → query flagged in `smwe_query_log` for gap analysis

### Feedback-to-improvement loop
1. User gives 👎
2. Query added to gap signal analysis
3. Gap detector clusters with similar queries
4. Cluster promoted to knowledge-authoring backlog
5. Expert authors additional content
6. Content deployed; gap signal resolved
7. Similar future queries answered correctly

---

## 3. Gap Signal Database Schema

```sql
CREATE TABLE smwe_gap_signals (
  id            INT            IDENTITY PRIMARY KEY,
  agent_id      NVARCHAR(32)   NOT NULL DEFAULT 'SMWE',
  topic_cluster NVARCHAR(200)  NOT NULL,
  signal_count  INT            NOT NULL DEFAULT 1,
  first_seen    DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
  last_seen     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
  status        NVARCHAR(20)   NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'authoring', 'resolved', 'dismissed'))
);

CREATE TABLE smwe_query_log (
  id              INT            IDENTITY PRIMARY KEY,
  agent_id        NVARCHAR(32)   NOT NULL DEFAULT 'SMWE',
  company_id      INT,
  query_text      NVARCHAR(2000) NOT NULL,
  intent_class    NVARCHAR(32),
  retrieval_score FLOAT,
  gap_flagged     BIT            NOT NULL DEFAULT 0,
  queried_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
  query_class     NVARCHAR(4)
);
```

---

## 4. Content Policy (inherits SPE content-policy.md)

- **SaaS neutrality:** No real individuals, employers, or case situations referenced
- **Deterministic rules:** All determination logic is rule-based, source-cited
- **Human review gate:** No module is production-ready until signed off by qualified expert
- **Disclaimer:** Every response includes: "This guidance is indicative and must be confirmed with the competent authority. SMWE does not provide legal advice, tax advice, or immigration filing services."
- **Legal sources:** Swiss legislation (Fedlex, freely reproducible under URG Art. 5), EU legislation (freely reproducible under EU reuse policy). No proprietary commentary reproduced.

---

*SMWE-UPDATE-FRAMEWORK | SevenSprings Technology AG | v1.0 | 2026-08-17*
