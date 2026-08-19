// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
// Proprietary and confidential. Unauthorised use prohibited. See LICENSE.
'use strict';

/**
 * services/orchestrator.js — SMWE Intent Classifier & Agent Dispatcher
 *
 * Phase 1: keyword-based intent classification, agent registry with 5-min cache.
 * Phase 3: will extend with MCP dispatch + result synthesis.
 */

const { getPool, sql } = require('../config/db');

// ─── Intent keyword maps ───────────────────────────────────────────────────────

const INTENT_KEYWORDS = {
  IMMIGRATION: [
    // Permits
    'aufenthaltsbewilligung', 'permit', 'bewilligung', 'ausweis',
    'b-ausweis', 'c-ausweis', 'l-ausweis', 'g-ausweis',
    'permis de séjour', 'autorisation de séjour', 'permesso di soggiorno',
    'grenzgängerbewilligung', 'niederlassungsbewilligung',
    // Visa / entry
    'visum', 'visa', 'einreise', 'schengen', 'vignette',
    // Quota / process
    'kontingent', 'quota', 'kontingentierung', 'inländervorrang',
    'sem', 'migrationsamt', 'ausländerrecht', 'aig', 'vzae',
    // Nationality
    'eu/efta', 'drittstaatsangehörige', 'drittstaaten', 'third country',
    'ressortissant', 'cittadino',
    // Family
    'familiennachzug', 'familienzusammenführung', 'regroupement familial',
    // Work authorisation
    'arbeitserlaubnis', 'arbeitsbewilligung', 'autorisation de travail',
  ],

  GLOBAL_MOBILITY: [
    // Assignment
    'entsendung', 'assignment', 'détachement', 'distacco', 'secondment',
    'entsendungsvertrag', 'assignee', 'expatriate', 'expat',
    'langzeitentsendung', 'kurzzeitentsendung',
    // Shadow / split payroll
    'shadow payroll', 'schattenlohnabrechnung', 'split payroll', 'lohnaufteilung',
    // PE risk
    'betriebsstätte', 'permanent establishment', 'pe risk',
    // Assignment lifecycle
    'pre-departure', 'repatriation', 'repatriierung', 'host country',
    'home country', 'assignment letter', 'relocation',
    // Business travellers
    'geschäftsreise', 'business travel', 'dienstreise', 'voyage d\'affaires',
    'short-term business visitor', 'stbv',
  ],

  CROSS_BORDER: [
    // Frontier workers
    'grenzgänger', 'frontalier', 'lavoratore frontaliero', 'cross-border worker',
    'grenzgängerausweis', 'permis g', 'permesso g',
    // Home office abroad
    'homeoffice', 'home office', 'télétravail', 'telelavoro', 'remote work',
    'homeoffice ausland', 'home office abroad', 'arbeiten von zuhause',
    // Country-specific cross-border
    'frontaliers franco-suisses', 'deutsch-schweizerisch', 'italo-svizzero',
    'accord frontalier', 'grenzgängerabkommen',
    // Thresholds
    '40%', '25%', '49.9%', 'wochenrückkehr', 'retour hebdomadaire',
  ],

  SOCIAL_SECURITY: [
    // EU 883 / A1
    'a1', 'a1-bescheinigung', 'a1 certificate', 'attestation a1',
    'sozialversicherung', 'anwendbares recht', 'droit applicable',
    'lex loci laboris', 'mehrstaatentätigkeit', 'art. 13', 'art. 12',
    'entsendebescheinigung', 'posting certificate',
    // Swiss SVs
    'ahv', 'iv', 'eo', 'alv', 'uvg', 'bvg', 'lpp', 'pk', 'pensionskasse',
    // Bilateral
    'sozialversicherungsabkommen', 'totalisierungsabkommen', 'bilateral',
    'zas', 'ausgleichskasse', 'alps',
    // Specific tests
    'substantial part', 'wesentlicher teil', 'partie substantielle',
    '25%', 'mehrstaaten', 'multi-state',
  ],

  DTA: [
    // DTA general
    'dba', 'doppelbesteuerungsabkommen', 'doppelbesteuerung',
    'convention de double imposition', 'cdi', 'double tax agreement', 'tax treaty',
    // Key articles
    '183 days', '183-tage', '183 tage', '183-day rule', '183-tage-regel',
    'art. 15', 'article 15', 'arbeitgebersitz', 'lohnzahlungspflicht',
    'ansässigkeit', 'residence', 'residenza', 'résidence fiscale',
    'art. 4', 'tie-breaker', 'lebensmittelpunkt',
    // PE
    'betriebsstätte', 'permanent establishment', 'fixed place', 'feste geschäftseinrichtung',
    // Relief
    'anrechnungsverfahren', 'freistellungsverfahren', 'kredit', 'credit method',
    // Countries
    'dba deutschland', 'dba frankreich', 'dba italien', 'dba österreich',
    'dba usa', 'dba uk', 'dba indien',
    // Equity / KS37
    'ks37', 'ks37a', 'mitarbeiterbeteiligung', 'rsu', 'aktienoptionen',
    'options', 'restricted shares', 'equity compensation',
  ],

  WORKFORCE: [
    // OR / labour law
    'arbeitsvertrag', 'contrat de travail', 'contratto di lavoro',
    'probezeit', 'kündigungsfrist', 'kündigung', 'entlassung',
    'or 319', 'or 336', 'sperrfrist', 'missbräuchliche kündigung',
    'massenkündigung', 'konsultationspflicht',
    // Working time
    'arbeitszeit', 'arbg', 'überstunden', 'nachtarbeit', 'sonntagsarbeit',
    'ruhezeit', 'arbeitsgesetz', 'seco',
    // CLA
    'gesamtarbeitsvertrag', 'gav', 'kollektivvertrag', 'ccl',
    'allgemeinverbindlich', 'mindestlohn', 'avv', 'lmav', 'lmv',
    // Equity
    'mitarbeiterbeteiligung', 'partizipationsplan', 'ks37',
    'aktienoptionen', 'rsu', 'phantom', 'sar',
    // Staffing
    'personalverleih', 'temporärarbeit', 'leiharbeit',
    'avg', 'arbeitsvermittlung', 'licence', 'bewilligung personalverleih',
  ],
};

// Cross-domain pairs that trigger C2 pricing
const CROSS_DOMAIN_PAIRS = [
  ['IMMIGRATION',     'GLOBAL_MOBILITY'],
  ['GLOBAL_MOBILITY', 'SOCIAL_SECURITY'],
  ['GLOBAL_MOBILITY', 'DTA'],
  ['CROSS_BORDER',    'SOCIAL_SECURITY'],
  ['CROSS_BORDER',    'DTA'],
  ['SOCIAL_SECURITY', 'DTA'],
  ['IMMIGRATION',     'WORKFORCE'],
  ['DTA',             'WORKFORCE'],
];

// ─── Intent classification ────────────────────────────────────────────────────

function classifyIntent(queryText, explicitModule) {
  if (!queryText) return 'unknown';
  const lower = queryText.toLowerCase();

  const scores = {};
  for (const [domain, keywords] of Object.entries(INTENT_KEYWORDS)) {
    scores[domain] = keywords.filter(kw => lower.includes(kw)).length;
  }

  const matched = Object.entries(scores)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([domain]) => domain);

  if (matched.length === 0) {
    if (explicitModule && INTENT_KEYWORDS[explicitModule]) return explicitModule;
    return 'unknown';
  }

  if (matched.length === 1) return matched[0];

  const isCross = CROSS_DOMAIN_PAIRS.some(
    ([a, b]) => matched.includes(a) && matched.includes(b)
  );
  return isCross ? 'cross_domain' : matched[0];
}

// ─── Agent registry ────────────────────────────────────────────────────────────

let _agentCache    = null;
let _agentCacheAt  = 0;
const AGENT_CACHE_TTL_MS = 5 * 60 * 1000;

async function getActiveAgents() {
  const now = Date.now();
  if (_agentCache && now - _agentCacheAt < AGENT_CACHE_TTL_MS) return _agentCache;

  try {
    const pool = await getPool();
    const { recordset } = await pool.request()
      .query(`SELECT agent_id, agent_name, mcp_endpoint, domains, capabilities
                FROM smwe_agent_registry
               WHERE status = 'active'`);
    const agents = recordset.map(row => ({
      ...row,
      domains:      JSON.parse(row.domains      || '[]'),
      capabilities: JSON.parse(row.capabilities || '[]'),
    }));
    _agentCache   = agents;
    _agentCacheAt = now;
    return agents;
  } catch (err) {
    if (err.message && err.message.includes('Invalid object name')) {
      console.warn('[orchestrator:SMWE] smwe_agent_registry not found — run migration 003');
    } else {
      console.error('[orchestrator:SMWE] registry load failed:', err.message);
    }
    return _getDefaultAgents();
  }
}

function _getDefaultAgents() {
  return [
    {
      agent_id:     'SMWE',
      agent_name:   'Swiss Mobility & Workforce Expert',
      mcp_endpoint: process.env.SMWE_API_URL || 'local',
      domains:      ['immigration','global_mobility','cross_border','social_security','dta','workforce_compliance'],
      capabilities: ['permit_classification','a1_assessment','dta_lookup','pe_risk','cla_lookup','equity_allocation'],
    },
    {
      agent_id:     'SPE',
      agent_name:   'Swiss Payroll Expert',
      mcp_endpoint: process.env.SPE_MCP_URL || '',
      domains:      ['payroll','social_security','employment'],
      capabilities: ['semantic_search','salary_calculation','deduction_lookup'],
    },
    {
      agent_id:     'SPC',
      agent_name:   'Swiss Professional Companion',
      mcp_endpoint: process.env.SPC_MCP_URL || '',
      domains:      ['tax','audit','fiduciary'],
      capabilities: ['semantic_search','regulatory_lookup'],
    },
  ];
}

function invalidateAgentCache() {
  _agentCache   = null;
  _agentCacheAt = 0;
}

function selectAgents(intentClass, module, agents) {
  if (intentClass === 'cross_domain') return agents;
  const target  = (module || intentClass || '').toLowerCase();
  const primary = agents.filter(a => a.domains.includes(target));
  return primary.length > 0 ? primary : agents.slice(0, 1);
}

async function dispatch(queryText, intentClass, opts = {}) {
  // Phase 3 — MCP multi-agent dispatch placeholder
  return null;
}

module.exports = { classifyIntent, getActiveAgents, invalidateAgentCache, selectAgents, dispatch };
