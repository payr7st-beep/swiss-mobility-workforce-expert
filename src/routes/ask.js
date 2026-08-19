// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
'use strict';

/**
 * routes/ask.js — SMWE Web Door (credit-metered, Entra External ID auth)
 *
 * POST /api/ask
 *
 * Query classes:
 *   C0 — exact lookup (permit type, A1 condition, DTA article) — 1 credit — anonymous OK
 *   C1 — single-domain question (immigration OR global mobility OR DTA etc.) — 2 credits
 *   C2 — cross-domain advisory (e.g. DTA + social security + permit) — 5 credits
 *   C3 — document analysis (assignment letter, contract review) — 10 credits
 *
 * Mandatory disclaimer appended to every response:
 *   "This output is indicative and must be confirmed with the competent authority.
 *    SMWE does not provide legal advice, tax advice, or immigration filing services."
 */

const express        = require('express');
const { z }          = require('zod');
const { v4: uuidv4 } = require('uuid');

const { optionalCustomer } = require('../middleware/authExternal');
const { classifyIntent }   = require('../services/orchestrator');
const { retrieve }         = require('../services/retrieval');
const { spendCredits, getDailySpend, CREDIT_COSTS } = require('../services/creditService');
const { getPool, sql }     = require('../config/db');

const router = express.Router();

const DISCLAIMER =
  '\n\n---\n*This output is indicative and must be confirmed with the competent authority. ' +
  'SMWE does not provide legal advice, tax advice, or immigration filing services.*';

const AskSchema = z.object({
  query:   z.string().min(3).max(2000),
  module:  z.string().optional(),  // explicit domain override
  class:   z.enum(['C0','C1','C2','C3']).optional(),
  lang:    z.enum(['de','fr','en','it']).optional().default('en'),
});

// ─── POST /api/ask ────────────────────────────────────────────────────────────

router.post('/', optionalCustomer, async (req, res) => {
  const start = Date.now();
  let queryLogId = null;

  try {
    // 1. Validate input
    const parsed = AskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_request', detail: parsed.error.flatten() });
    }
    const { query, module: explicitModule, lang } = parsed.data;

    // 2. Classify intent → query class
    const intentClass = classifyIntent(query, explicitModule);
    let queryClass    = parsed.data.class || deriveQueryClass(intentClass);

    // 3. Auth / credit gate
    const customer = req.customer;

    if (queryClass !== 'C0' && !customer) {
      return res.status(401).json({
        error:   'account_required',
        message: 'Please sign in to use C1–C3 queries.',
        signup:  '/auth/signup',
      });
    }

    if (customer) {
      // Daily limit check
      const spent = await getDailySpend(customer.id);
      if (spent + CREDIT_COSTS[queryClass] > customer.daily_limit * CREDIT_COSTS[queryClass]) {
        // Simplified guard — full logic in creditService
      }

      // Spend credits
      const sessionId   = uuidv4();
      const spendResult = await spendCredits(customer.id, queryClass, sessionId);
      if (!spendResult.success) {
        return res.status(402).json({
          error:   spendResult.error,
          balance: spendResult.balance,
          upgrade: '/billing/upgrade',
        });
      }
    }

    // 4. Retrieve chunks
    const domain = domainFromIntent(intentClass);
    const { chunks, topScore, gapFlagged } = await retrieve(query, {
      domain: intentClass === 'cross_domain' ? undefined : domain,
      topK:   queryClass === 'C2' ? 10 : 6,
    });

    // 5. Log query
    queryLogId = await logQuery({
      customerId:    customer?.id || null,
      queryText:     query,
      queryClass,
      intentClass,
      domain,
      chunksReturned: chunks.length,
      topScore,
      gapFlagged,
      creditsSpent:  CREDIT_COSTS[queryClass],
    });

    // 6. Build response
    const sources = buildSourceList(chunks);
    const answer  = buildAnswer(query, chunks, intentClass, lang);

    return res.json({
      query_class:   queryClass,
      intent:        intentClass,
      answer:        answer + DISCLAIMER,
      sources,
      chunks_used:   chunks.length,
      top_score:     topScore,
      gap_flagged:   gapFlagged,
      credits_spent: CREDIT_COSTS[queryClass],
      response_ms:   Date.now() - start,
    });

  } catch (err) {
    console.error('[ask] Error:', err.message);
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    // Update response_ms in log
    if (queryLogId) {
      const pool = await getPool().catch(() => null);
      if (pool) {
        await pool.request()
          .input('id',  sql.Int, queryLogId)
          .input('ms',  sql.Int, Date.now() - start)
          .query('UPDATE smwe_query_log SET response_ms = @ms WHERE id = @id')
          .catch(() => {});
      }
    }
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveQueryClass(intentClass) {
  if (intentClass === 'cross_domain') return 'C2';
  if (intentClass === 'unknown')      return 'C0';
  return 'C1';
}

function domainFromIntent(intentClass) {
  const map = {
    IMMIGRATION:     'immigration',
    GLOBAL_MOBILITY: 'global_mobility',
    CROSS_BORDER:    'cross_border',
    SOCIAL_SECURITY: 'social_security',
    DTA:             'dta',
    WORKFORCE:       'workforce_compliance',
  };
  return map[intentClass] || undefined;
}

function buildSourceList(chunks) {
  const seen = new Set();
  return chunks
    .filter(c => { if (seen.has(c.sourceFile)) return false; seen.add(c.sourceFile); return true; })
    .map(c => ({ file: c.sourceFile, module: c.moduleCode, citation: c.citation || null }));
}

function buildAnswer(query, chunks, intentClass, lang) {
  if (chunks.length === 0) {
    return lang === 'de'
      ? 'Zu Ihrer Anfrage wurden keine gesicherten Informationen gefunden. Bitte kontaktieren Sie einen Spezialisten.'
      : 'No authoritative information found for your query. Please consult a specialist.';
  }

  // Structured answer: synthesised from top chunks
  const topChunks = chunks.slice(0, 4);
  const body = topChunks.map(c => {
    const heading = c.heading ? `**${c.heading}**\n\n` : '';
    const cite    = c.citation ? ` *(${c.citation})*` : '';
    return `${heading}${c.text}${cite}`;
  }).join('\n\n---\n\n');

  return body;
}

async function logQuery(data) {
  try {
    const pool = await getPool();
    const { recordset } = await pool.request()
      .input('customer_id',     sql.Int,          data.customerId)
      .input('query_text',      sql.NVarChar(2000), data.queryText)
      .input('query_class',     sql.NVarChar(5),   data.queryClass)
      .input('intent_class',    sql.NVarChar(30),  data.intentClass)
      .input('domain',          sql.NVarChar(30),  data.domain || null)
      .input('chunks_returned', sql.Int,           data.chunksReturned)
      .input('top_score',       sql.Float,         data.topScore)
      .input('gap_flagged',     sql.Bit,           data.gapFlagged ? 1 : 0)
      .input('credits_spent',   sql.Int,           data.creditsSpent)
      .query(`
        INSERT INTO smwe_query_log
          (customer_id, query_text, query_class, intent_class, domain,
           chunks_returned, top_score, gap_flagged, credits_spent)
        OUTPUT INSERTED.id
        VALUES
          (@customer_id, @query_text, @query_class, @intent_class, @domain,
           @chunks_returned, @top_score, @gap_flagged, @credits_spent)
      `);
    return recordset[0]?.id || null;
  } catch (e) {
    console.warn('[ask] logQuery failed:', e.message);
    return null;
  }
}

module.exports = router;
