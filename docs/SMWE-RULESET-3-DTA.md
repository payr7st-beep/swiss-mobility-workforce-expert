# SMWE Rule Set 3 — Double Taxation Agreement (DTA) Classification Engine

**Sources:** SIF DTA list (sif.admin.ch, current) · ESTV DTA texts (estv.admin.ch) · OECD Model Tax Convention 2017 · ESTV KS37 (2023) · ESTV KS37A (2024) · Selected bilateral DTA texts (CH-DE 1971/2002, CH-FR 1966/2010/2023, CH-IT 1976/2023, CH-AT 2000, CH-UK 1977/2007, CH-US 1996/2009, CH-IN 1994, CH-CN 2013)  
**Extraction date:** 2026-08-17 | **Status:** `reviewed: false` — pending International Tax Advisor / SIF practitioner sign-off  
**Cross-links:** Social security applicable legislation is separate from DTA residence (Rule Set 1). Permit type determines right to work — independent of DTA (Rule Set 2). QST calculation → SPE Rule Set 4 / KS45. Equity allocation → ESTV KS37A (KB-05 §E, KB-06 §D).

---

## A. DTA Network Overview

Switzerland has concluded **over 100 DTAs** (as of 2026). The SIF (State Secretariat for International Finance) maintains the authoritative list. All DTAs follow the OECD Model Tax Convention (MTC) structure, with derogations negotiated bilaterally.

**Purpose of a DTA:**
- Prevent double taxation of the same income in two states
- Prevent double non-taxation (treaty shopping; addressed by BEPS/MLI)
- Allocate taxing rights between residence and source states
- Provide mutual agreement procedure (MAP) for disputes

**SMWE scope:** DTA determination for employment income (Art. 15 OECD MTC), directors' fees (Art. 16), pensions (Art. 18/19), and permanent establishment risk (Art. 5). DTA provisions on dividends, interest, royalties, and corporate income are outside SMWE scope (→ SPC or EXT-003 International Tax Advisor).

---

## B. DTA Classification Decision Tree

```
Step 1: Is Switzerland involved?
├── CH is the RESIDENCE state (employee lives in CH, works abroad)
│   → DTA of the HOST country applies; CH exempts or credits
└── CH is the SOURCE state (employee lives abroad, works in CH)
    → Swiss cantonal/federal tax applies; DTA may limit CH's right to tax

Step 2: Identify applicable DTA
├── DTA exists between CH and the other state? → Apply DTA
└── No DTA? → Domestic law applies; double taxation risk (unilateral relief may apply)

Step 3: Classify income
├── Employment income (salary, bonus, benefits in kind) → Art. 15
├── Directors' fees (board members of a company) → Art. 16
├── Pensions (private, occupational) → Art. 18
├── Government pensions / civil service → Art. 19
└── Other income → specific DTA article

Step 4: Apply 183-day rule (Art. 15 §2)
├── All three conditions met? → Taxing right stays with RESIDENCE state
└── Any condition not met? → SOURCE state (where work performed) may tax
```

---

## C. Article 15 — Employment Income (Lex Loci Laboris vs. Residence)

### C.1 General Rule (Art. 15 §1)

**Salary, wages, and other similar remuneration** from employment are taxable:
- In the **state of residence** of the employee, UNLESS
- The employment is exercised in the other contracting state → that **source state** may also tax

### C.2 The 183-Day Exception (Art. 15 §2)

Employment income is taxable **only in the residence state** when ALL THREE conditions are satisfied simultaneously:

| Condition | Test |
|---|---|
| **1. Presence** | Employee is present in the source state for ≤ 183 days in the relevant period |
| **2. Payer** | Remuneration is paid by, or on behalf of, an employer who is NOT a resident of the source state |
| **3. Burden** | Remuneration is NOT borne by a permanent establishment or fixed base of the employer in the source state |

**If any one condition fails → source state taxing right applies.**

### C.3 Counting the 183 Days

**Period definition varies by DTA:**

| Period type | Examples | How to count |
|---|---|---|
| Calendar year | CH-DE, CH-AT, CH-IT | 1 Jan – 31 Dec; count all physical presence days |
| Fiscal year | Some older DTAs | Per local fiscal year definition |
| Any 12-month period | OECD 2017 MTC; CH-UK, CH-US post-protocol | Rolling 12-month window; count most favourable period |

**What counts as a "day":**
- Physical presence in the source state at any time during the day counts as 1 day
- Days of arrival and departure each count as 1 day
- Weekends and public holidays during a work period count if the employee is present
- Vacation, sick leave, and training days in the source state count
- Days in a third state do NOT count toward the 183-day threshold

**SMWE working day tracking threshold:** 183 calendar days of presence ≠ 183 working days. Always count calendar presence days, not contractual work days.

---

## D. Priority Treaty Corridors

### D.1 Switzerland–Germany (CH-DE DTA 1971, Protocol 2002, Administrative Agreement 2010)

| Feature | Rule |
|---|---|
| Period | Calendar year |
| 183-day count | Physical presence days in Germany |
| Frontier workers (Grenzgänger) | Special Art. 15a: taxed in Germany; Switzerland grants credit; special commuter certificate required |
| Home office (since 2023) | Up to 25 home-office days in Germany per year: Germany does not lose taxing right; above 25 days → Germany taxes pro-rata |
| Board members | Art. 16: director fees taxable in Germany if company is German-resident |
| A1/social security | Separate from DTA — EU 883/2004 applies |

**Frontier worker rule (Art. 15a):** Applies to residents of German border zone working in Switzerland (and vice versa) who return daily. Switzerland taxes 4.5% at source; Germany grants full credit. Certificate of frontier worker status must be renewed annually.

### D.2 Switzerland–France (CH-FR DTA 1966, Protocol 2010, Administrative Agreement 2023)

| Feature | Rule |
|---|---|
| Period | Calendar year |
| 183-day count | Physical presence days in France |
| Frontier workers | Special Accord frontalier: employees living in French border departments and working in certain Swiss cantons — France taxes exclusively |
| Home office (since 2023) | 40% of annual working time may be performed from home in France without losing frontier worker status (see SMWE KB-03 §B) |
| Geneva canton | Different tax-sharing arrangement: 3.5% tax paid to Geneva; refunded to France |
| A1/social security | EU 883/2004 applies (France is EU member; Switzerland–EU AFMP) |

**Key risk:** Swiss employers with French frontier workers who exceed 40% home office lose the frontier worker treaty benefit for the excess days — source taxation shifts to France for those days.

### D.3 Switzerland–Italy (CH-IT DTA 1976, Protocol 2023 — New Frontaliers Agreement)

| Feature | Rule |
|---|---|
| Period | Calendar year |
| Old frontaliers (residence before 17 Jul 2023) | Switzerland taxes exclusively; Italy grants exemption (legacy regime) |
| New frontaliers (from 17 Jul 2023) | Concurrent taxation: Switzerland taxes at source (max rate); Italy taxes with credit for Swiss tax |
| 25% home-office threshold | New frontaliers: up to 25% of working time from Italian home office permitted without losing frontalier status |
| Period review | 5-year review clause in 2023 Protocol |
| A1/social security | EU 883/2004 applies (Italy is EU member) |

### D.4 Switzerland–Austria (CH-AT DTA 2000)

| Feature | Rule |
|---|---|
| Period | Calendar year |
| 183-day count | Physical presence days in Austria |
| Frontier workers | No special frontier worker article; standard Art. 15 applies |
| Home office | No specific home-office protocol; standard Art. 15 §2 — each home-office day is an Austrian presence day |
| A1/social security | EU 883/2004 applies |

### D.5 Switzerland–United Kingdom (CH-UK DTA 1977, Protocol 2007)

| Feature | Rule |
|---|---|
| Period | Any 12-month period commencing/ending in fiscal year |
| 183-day count | Rolling 12-month; count physical presence days in UK |
| Post-Brexit social security | UK-CH Social Security Protocol (not EU 883/2004) — see SMWE KB-04 §E |
| Home office | No specific home-office protocol; standard 183-day count |
| DTA MAP | Mutual Agreement Procedure available; HMRC and ESTV competent authorities |

### D.6 Switzerland–United States (CH-US DTA 1996, Protocol 2009)

| Feature | Rule |
|---|---|
| Period | Calendar year |
| 183-day count | Physical presence days in US |
| US citizenship rule | US taxes its citizens on worldwide income regardless of DTA; Swiss residents who are US citizens face dual filing obligation |
| LOB clause | Limitation on Benefits (LOB) clause in Protocol limits treaty shopping |
| Savings clause | US retains right to tax its citizens/green card holders as if DTA did not exist |
| Social security | US-CH Totalization Agreement (1980) — bilateral; not EU 883/2004 |
| A1 equivalent | Certificate of Coverage (CoC) issued by SSA (US) or SVA (CH) |

**Practitioner note:** US persons (citizens, green card holders) working in Switzerland face dual tax filing regardless of treaty. SMWE boundary: refer to EXT-003 (International Tax Advisor) or EXT-105 (US Tax Specialist) for dual-filer cases.

### D.7 Switzerland–India (CH-IN DTA 1994)

| Feature | Rule |
|---|---|
| Period | Fiscal year (India: 1 Apr – 31 Mar) |
| 183-day count | Presence in India during fiscal year |
| Withholding | India withholds at standard rates; DTA reduces for Swiss residents |
| Social security | Bilateral SVA agreement in force (limited scope) |

### D.8 Switzerland–China (CH-CN DTA 2013)

| Feature | Rule |
|---|---|
| Period | Calendar year |
| 183-day count | Physical presence in China |
| Individual Income Tax (IIT) | China IIT applies; DTA may reduce but not eliminate where 183-day threshold is exceeded |
| Social security | No comprehensive bilateral agreement; dual contribution risk for long-term assignments |

---

## E. DTA Application Process (Six Steps)

### Step 1 — Establish Residence
Determine the employee's **tax residence** under each state's domestic law. Use the DTA Art. 4 tie-breaker cascade if dual residence results:
1. Permanent home
2. Centre of vital interests
3. Habitual abode
4. Nationality
5. Mutual agreement

### Step 2 — Classify Income
Identify the DTA article that governs the income type. Employment income → Art. 15. Directors' fees → Art. 16. Most common: Art. 15 for assignees and cross-border workers.

### Step 3 — Apply 183-Day Rule
Count presence days in the source state for the relevant period (calendar year or rolling 12 months, per specific DTA). If all three conditions of Art. 15 §2 are met → residence state taxes only.

### Step 4 — Check Special Provisions
- Frontier worker article (CH-DE Art. 15a; CH-FR Accord frontalier)
- Home-office protocol (CH-DE 25 days; CH-FR 40%)
- Equity compensation allocation (KS37A international split)
- Directors' fees (Art. 16 — different from Art. 15)

### Step 5 — Determine Relief Method
| Method | How it works | Examples |
|---|---|---|
| Exemption with progression | CH exempts foreign income but includes it to determine rate on remaining income | Most CH DTAs for employment income |
| Credit method | CH taxes worldwide income; credits foreign tax paid | Some DTAs; always applies for US persons |

### Step 6 — File and Document
- Employee submits DTA claim on Swiss tax return (Steuererklärung) or withholding reclaim
- Employer issues Lohnausweis with foreign allocation noted (SPE Rule Set 3)
- Certificate of residence (Ansässigkeitsbescheinigung) from ESTV on request for foreign authority
- MAP available if double taxation cannot be resolved (Art. 25 OECD MTC)

---

## F. Permanent Establishment Risk (Art. 5 OECD MTC)

A permanent establishment (PE) in Switzerland arises when a foreign enterprise has:
- A **fixed place of business** in Switzerland (office, factory, branch — including a home office used regularly)
- A **dependent agent** who habitually concludes contracts on behalf of the foreign enterprise
- A **construction site or project** lasting more than 12 months (Art. 5 §3; varies by DTA)

**PE triggers SMWE monitors:**
- Employee working from Swiss home office on behalf of foreign employer
- Travelling manager habitually negotiating/concluding contracts in Switzerland
- Assignment employee with authority to bind the foreign entity
- Duration of construction/service projects (check specific DTA threshold — some DTAs: 6 months)

**PE consequences:**
- Foreign enterprise becomes subject to Swiss corporate income tax on profits attributable to the PE
- Canton and municipality where PE is located has taxing jurisdiction
- Transfer pricing principles apply to allocate profit to the PE
- Registration and compliance obligations with cantonal tax authority

**Mitigation:** Limit employee authority; prohibit contract conclusion in Switzerland; structure role as service delivery (not contracting). Refer to EXT-102 (Immigration/Tax Lawyer) and EXT-003 (International Tax Advisor) for formal PE risk opinion.

---

## G. DTA Country Classification Matrix

### G.1 Europe — Key DTAs

| Country | DTA year | Period | Special provisions |
|---|---|---|---|
| Germany | 1971/2002 | Calendar year | Frontier workers (Art. 15a); 25 home-office days |
| France | 1966/2010/2023 | Calendar year | Frontier worker accord; 40% HO; Geneva regime |
| Italy | 1976/2023 | Calendar year | Old/new frontalier split; 25% HO threshold |
| Austria | 2000 | Calendar year | Standard Art. 15; no frontier worker article |
| Luxembourg | 1993 | Calendar year | Frontier workers; 24 HO days protocol (2024) |
| Netherlands | 2010 | Calendar year | Standard; 30% ruling interaction |
| Belgium | 1978 | Calendar year | Standard; complex frontier worker rules |
| Spain | 1966/2012 | Calendar year | Standard |
| Portugal | 1974 | Calendar year | Standard |
| Sweden | 1965/2007 | Calendar year | Standard |
| Norway | 1956/2015 | Calendar year | EFTA member; standard |
| Liechtenstein | 2015 | Calendar year | Special commuter provisions |
| United Kingdom | 1977/2007 | 12-month rolling | Post-Brexit; no EU 883 |
| Ireland | 1966 | Calendar year | Standard |
| Poland | 1991 | Calendar year | Standard |
| Czech Republic | 1996 | Calendar year | Standard |
| Hungary | 1981 | Calendar year | Standard |

### G.2 Americas

| Country | DTA year | Period | Special provisions |
|---|---|---|---|
| United States | 1996/2009 | Calendar year | Savings clause; LOB; US citizenship rule |
| Canada | 1976/2010 | Calendar year | Standard |
| Mexico | 1993 | Calendar year | Standard |
| Brazil | No DTA | — | Domestic law only; double taxation risk |
| Argentina | No DTA | — | Domestic law only |

### G.3 Asia-Pacific

| Country | DTA year | Period | Special provisions |
|---|---|---|---|
| Japan | 1971/2011 | Calendar year | Standard |
| China | 2013 | Calendar year | Standard; IIT interaction |
| India | 1994 | Indian fiscal year | Standard |
| Singapore | 1975/2012 | Calendar year | Standard |
| Australia | 1980/2013 | Calendar year | Standard |
| South Korea | 1980/2012 | Calendar year | Standard |
| Hong Kong | 2011 | Calendar year | Standard |

### G.4 MENA / Africa

| Country | DTA year | Notes |
|---|---|---|
| UAE | 2011 | No UAE income tax currently; limited practical impact |
| South Africa | 2007 | Standard |
| Israel | 2003 | Standard |
| Turkey | 2009 | Standard |

---

## H. Key Constants for SMWE Determinations

| Item | Value | Reference |
|---|---|---|
| 183-day threshold (Art. 15 §2) | 183 calendar days of physical presence | OECD MTC Art. 15 §2 |
| CH-DE home-office tolerance | 25 days per calendar year | CH-DE Administrative Agreement 2010 |
| CH-FR home-office tolerance | 40% of annual working time | CH-FR Protocol 2023 |
| CH-IT new frontalier home-office | 25% of annual working time | CH-IT Protocol 2023 |
| CH-LU home-office tolerance | 24 days per calendar year | CH-LU Protocol 2024 |
| PE construction threshold | 12 months (OECD standard); check specific DTA | OECD MTC Art. 5 §3 |
| Art. 4 tie-breaker cascade | Permanent home → vital interests → habitual abode → nationality → MAP | OECD MTC Art. 4 §2 |
| Equity allocation base | Grant to vest/exercise period; Swiss work days ÷ total days | ESTV KS37A |

---

*SMWE-RULESET-3-DTA | SevenSprings Technology AG | v1.0 | 2026-08-17 | reviewed: false — pending sign-off*
