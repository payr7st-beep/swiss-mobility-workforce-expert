// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
'use strict';

/**
 * services/retrieval.js — SMWE RAG retrieval core
 *
 * retrieve(query, opts)  → ranked cited chunks (all domains or filtered)
 * getPermit(query)       → permit-specific chunks (immigration domain)
 * getTreaty(query)       → DTA/social-security-agreement chunks
 *
 * Uses Azure SQL native VECTOR_DISTANCE('cosine', ...) — no separate vector DB.
 * Mirrors SPE services/retrieval.js architecture.
 */

require('dotenv').config();
const { getPool, sql } = require('../config/db');
const { embedOne }     = require('./embeddings');

const TOP_K           = parseInt(process.env.RETRIEVAL_TOP_K       || '6',    10);
const MIN_SCORE       = parseFloat(process.env.RETRIEVAL_MIN_SCORE || '0.35'      );
const GAP_THRESHOLD   = parseFloat(process.env.RETRIEVAL_GAP_THRESH || '0.30'    );

/**
 * Core retrieval — embed the query, vector-search smwe_chunks, return ranked results.
 *
 * @param {string}   query
 * @param {object}   opts
 * @param {string}   [opts.domain]      — filter by domain (immigration|global_mobility|...)
 * @param {string}   [opts.moduleCode]  — filter by module code (KB-01, RS-1, ...)
 * @param {number}   [opts.topK]
 * @returns {Promise<{chunks: Array, topScore: number, gapFlagged: boolean}>}
 */
async function retrieve(query, opts = {}) {
  const topK   = opts.topK || TOP_K;
  const vector = await embedOne(query);
  const pool   = await getPool();

  const req = pool.request()
    .input('query_vec', sql.NVarChar(sql.MAX), vector)
    .input('top_k',     sql.Int,               topK);

  let where = '';
  if (opts.domain) {
    req.input('domain', sql.NVarChar(30), opts.domain);
    where += ' AND c.domain = @domain';
  }
  if (opts.moduleCode) {
    req.input('module_code', sql.NVarChar(20), opts.moduleCode);
    where += ' AND c.module_code = @module_code';
  }

  const { recordset } = await req.query(`
    SELECT TOP (@top_k)
           c.chunk_id,
           c.source_file,
           c.module_code,
           c.domain,
           c.chunk_kind,
           c.heading,
           c.citation,
           c.chunk_text,
           CAST(
             1 - VECTOR_DISTANCE('cosine', c.embedding, CAST(@query_vec AS VECTOR(1024)))
           AS FLOAT) AS score
      FROM smwe_chunks c
     WHERE c.embedding IS NOT NULL
       ${where}
     ORDER BY score DESC
  `);

  const topScore  = recordset.length > 0 ? recordset[0].score : 0;
  const gapFlagged = topScore < GAP_THRESHOLD;

  const chunks = recordset
    .filter(r => r.score >= MIN_SCORE)
    .map(r => ({
      chunkId:    r.chunk_id,
      sourceFile: r.source_file,
      moduleCode: r.module_code,
      domain:     r.domain,
      kind:       r.chunk_kind,
      heading:    r.heading,
      citation:   r.citation,
      text:       r.chunk_text,
      score:      Math.round(r.score * 1000) / 1000,
    }));

  return { chunks, topScore, gapFlagged };
}

/**
 * Permit-specific retrieval — wraps retrieve with immigration domain filter.
 */
async function getPermit(query, opts = {}) {
  return retrieve(query, { ...opts, domain: 'immigration' });
}

/**
 * Treaty retrieval — social_security and dta domains.
 */
async function getTreaty(query, opts = {}) {
  // Search both domains and merge
  const [ss, dta] = await Promise.all([
    retrieve(query, { ...opts, domain: 'social_security' }),
    retrieve(query, { ...opts, domain: 'dta' }),
  ]);

  const all = [...ss.chunks, ...dta.chunks]
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.topK || TOP_K);

  const topScore   = all.length > 0 ? all[0].score : 0;
  const gapFlagged = topScore < GAP_THRESHOLD;
  return { chunks: all, topScore, gapFlagged };
}

module.exports = { retrieve, getPermit, getTreaty, MIN_SCORE, GAP_THRESHOLD };
