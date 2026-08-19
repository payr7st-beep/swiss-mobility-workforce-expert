// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
// Proprietary and confidential. Unauthorised use prohibited. See LICENSE.
'use strict';

/**
 * services/gapDetector.js — SMWE Corpus Gap Detection
 *
 * Analyses smwe_query_log for queries with low retrieval quality and surfaces
 * recurring topic clusters as gap signals in smwe_gap_signals.
 *
 * Invocation:
 *   - Manually:  node services/gapDetector.js
 *   - Via cron:  GitHub Actions workflow or Azure Function Timer trigger
 *   - Via API:   POST /api/admin/gap-detect  (Phase 3 admin routes)
 *
 * Configuration (env vars):
 *   SMWE_GAP_LOOKBACK_HOURS  — hours of query log to scan (default 24)
 *   SMWE_GAP_MIN_SIGNALS     — minimum occurrences before writing gap row (default 2)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { getPool, sql } = require('../config/db');

const LOOKBACK_HOURS = parseInt(process.env.SMWE_GAP_LOOKBACK_HOURS || '24', 10);
const MIN_SIGNALS    = parseInt(process.env.SMWE_GAP_MIN_SIGNALS    || '2',  10);

// German / French / English stopwords
const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einer',
  'und', 'oder', 'aber', 'für', 'von', 'mit', 'bei', 'nach', 'aus', 'auf',
  'ist', 'sind', 'hat', 'haben', 'wird', 'werden', 'wie', 'was', 'wer',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'est', 'sont',
  'the', 'a', 'an', 'and', 'or', 'is', 'are', 'of', 'to', 'in', 'for',
  'how', 'what', 'when', 'where', 'which', 'who', 'does', 'do', 'can', 'will',
  'ich', 'sie', 'wir', 'man', 'je', 'nous', 'i', 'we', 'you',
]);

// SMWE domain pivot terms (lifted to front of cluster label)
const DOMAIN_PIVOTS = [
  // Immigration
  'aufenthaltsbewilligung', 'permit', 'bewilligung', 'grenzgänger', 'frontalier',
  'visum', 'visa', 'einreise', 'quotas', 'quota', 'sem', 'migrationsamt',
  'inländervorrang', 'arbeitsmarkt',
  // Global mobility
  'entsendung', 'assignment', 'détachement', 'shadow payroll', 'split payroll',
  'entsendungsvertrag', 'host', 'home', 'expatriate', 'expat',
  // Social security / A1
  'a1', 'a1-bescheinigung', 'sozialversicherung', 'ahv', 'alv',
  'entsendebescheinigung', 'mehrstaatentätigkeit', 'posting', 'pflichtversicherung',
  'anwendbares recht', 'droit applicable',
  // DTA / tax
  'dba', 'doppelbesteuerung', 'doppelbesteuerungsabkommen',
  'quellensteuer', 'withholding', '183', '183-tage', '183 days',
  'betriebsstätte', 'permanent establishment', 'ansässigkeit', 'residence',
  // Workforce
  'gesamtarbeitsvertrag', 'gav', 'kollektivvertrag', 'mindestlohn',
  'arbeitszeit', 'überstunden', 'cla', 'ortsüblicher lohn',
  'mitarbeiterbeteiligung', 'rsu', 'aktienoptionen', 'ks37',
  // Cross-border
  'homeoffice', 'home office', 'télétravail', 'grenzgänger',
  'arbeitsortsprinzip', 'lohnaufteilung',
];

// ─── Topic extraction ─────────────────────────────────────────────────────────

function extractTopicCluster(text) {
  if (!text) return 'unknown';
  const lower = text.toLowerCase();

  const pivots = DOMAIN_PIVOTS.filter(p => lower.includes(p));
  if (pivots.length > 0) return pivots.slice(0, 3).join(' / ');

  const tokens = lower
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 3 && !STOPWORDS.has(t));

  if (tokens.length === 0) return text.slice(0, 80);
  return [...new Set(tokens)].slice(0, 4).join(' / ');
}

// ─── Upsert gap signal ────────────────────────────────────────────────────────

async function upsertGapSignal(agentId, topicCluster) {
  const pool = await getPool();
  const { recordset } = await pool.request()
    .input('agent_id',      sql.NVarChar(32),  agentId)
    .input('topic_cluster', sql.NVarChar(200), topicCluster)
    .query(`
      SELECT id FROM smwe_gap_signals
       WHERE agent_id = @agent_id
         AND topic_cluster = @topic_cluster
         AND status IN ('open','authoring')
    `);

  if (recordset.length > 0) {
    await pool.request()
      .input('id', sql.Int, recordset[0].id)
      .query(`
        UPDATE smwe_gap_signals
           SET signal_count = signal_count + 1,
               last_seen    = SYSUTCDATETIME()
         WHERE id = @id
      `);
  } else {
    await pool.request()
      .input('agent_id',      sql.NVarChar(32),  agentId)
      .input('topic_cluster', sql.NVarChar(200), topicCluster)
      .query(`INSERT INTO smwe_gap_signals (agent_id, topic_cluster) VALUES (@agent_id, @topic_cluster)`);
  }
}

// ─── Main detection run ───────────────────────────────────────────────────────

async function runGapDetection() {
  console.log('[gapDetector:SMWE] Starting (lookback: ' + LOOKBACK_HOURS + 'h)...');

  let recordset;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('hours_neg', sql.Int, -LOOKBACK_HOURS)
      .query(`
        SELECT id, agent_id, query_text
          FROM smwe_query_log
         WHERE gap_flagged = 1
           AND queried_at >= DATEADD(HOUR, @hours_neg, SYSUTCDATETIME())
      `);
    recordset = result.recordset;
  } catch (err) {
    if (err.message && err.message.includes('Invalid object name')) {
      console.warn('[gapDetector:SMWE] smwe_query_log not found — run migration 003 first');
      return { scanned: 0, clusters: 0, written: 0 };
    }
    throw err;
  }

  console.log('[gapDetector:SMWE] Flagged queries: ' + recordset.length);
  if (recordset.length === 0) return { scanned: 0, clusters: 0, written: 0 };

  const clusterMap = new Map();
  for (const row of recordset) {
    const cluster = extractTopicCluster(row.query_text);
    const key     = (row.agent_id || 'SMWE') + '|||' + cluster;
    clusterMap.set(key, (clusterMap.get(key) || 0) + 1);
  }

  let written = 0;
  for (const [key, count] of clusterMap.entries()) {
    if (count < MIN_SIGNALS) continue;
    const [agentId, topicCluster] = key.split('|||');
    await upsertGapSignal(agentId, topicCluster);
    written++;
    console.log('[gapDetector:SMWE]   ' + agentId + ': "' + topicCluster + '" (' + count + ' signals)');
  }

  console.log('[gapDetector:SMWE] Done. Clusters: ' + clusterMap.size + ', written: ' + written);
  return { scanned: recordset.length, clusters: clusterMap.size, written };
}

async function listOpenGaps(agentId, limit = 50) {
  const pool = await getPool();
  const req  = pool.request().input('limit', sql.Int, limit);
  let where  = "WHERE status IN ('open','authoring')";
  if (agentId) {
    req.input('agent_id', sql.NVarChar(32), agentId);
    where += ' AND agent_id = @agent_id';
  }
  const { recordset } = await req.query(
    `SELECT TOP (@limit) id, agent_id, topic_cluster, signal_count, first_seen, last_seen, status
       FROM smwe_gap_signals
      ${where}
      ORDER BY signal_count DESC, last_seen DESC`
  );
  return recordset;
}

module.exports = { runGapDetection, upsertGapSignal, listOpenGaps, extractTopicCluster };

// ─── CLI entrypoint ───────────────────────────────────────────────────────────
if (require.main === module) {
  runGapDetection()
    .then(r => { console.log('\nResult:', JSON.stringify(r, null, 2)); process.exit(0); })
    .catch(e => { console.error('[gapDetector:SMWE] Fatal:', e.message); process.exit(1); });
}
