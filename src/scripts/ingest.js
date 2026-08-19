// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
'use strict';

/**
 * scripts/ingest.js — SMWE Knowledge Base ingestion pipeline
 *
 * Reads all .md files from knowledge-base/ and docs/SMWE-RULESET-*.md,
 * splits into chunks via lib/chunker.js, embeds via services/embeddings.js,
 * and upserts into smwe_chunks.
 *
 * Usage:
 *   node scripts/ingest.js              # full ingest
 *   node scripts/ingest.js --dry-run    # chunk + count only; no DB writes
 *   node scripts/ingest.js --file KB-01 # single file match
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs   = require('fs');
const path = require('path');
const { getPool, sql } = require('../config/db');
const { embedOne }     = require('../services/embeddings');
const { chunkMarkdown } = require('../lib/chunker');

const DRY_RUN    = process.argv.includes('--dry-run');
const FILE_MATCH = (() => { const i = process.argv.indexOf('--file'); return i > -1 ? process.argv[i+1] : null; })();

const REPO_ROOT = path.join(__dirname, '../../');
const SOURCES   = [
  { glob: path.join(REPO_ROOT, 'knowledge-base/*.md'),          domain: null },      // domain from filename
  { glob: path.join(REPO_ROOT, 'docs/SMWE-RULESET-*.md'),       domain: null },
];

const DOMAIN_MAP = {
  'KB-01': 'immigration',
  'KB-02': 'global_mobility',
  'KB-03': 'cross_border',
  'KB-04': 'social_security',
  'KB-05': 'dta',
  'KB-06': 'workforce_compliance',
  'RS-1':  'social_security',
  'RS-2':  'immigration',
  'RS-3':  'dta',
};

function detectDomain(filename) {
  for (const [key, domain] of Object.entries(DOMAIN_MAP)) {
    if (filename.includes(key)) return domain;
  }
  return 'general';
}

function detectModuleCode(filename) {
  const match = filename.match(/(KB-\d+|RS-\d+|RULESET-\d+)/i);
  if (!match) return 'general';
  return match[1].replace('RULESET-', 'RS-').toUpperCase();
}

async function getOrCreateRun(pool, sourceFile) {
  const { recordset } = await pool.request()
    .input('source_file', sql.NVarChar(200), sourceFile)
    .query(`
      INSERT INTO smwe_ingest_runs (source_file)
      OUTPUT INSERTED.id
      VALUES (@source_file)
    `);
  return recordset[0].id;
}

async function upsertChunk(pool, runId, chunk) {
  await pool.request()
    .input('chunk_id',      sql.NVarChar(64),       chunk.chunkId)
    .input('source_file',   sql.NVarChar(200),      chunk.sourceFile)
    .input('module_code',   sql.NVarChar(20),       chunk.moduleCode)
    .input('domain',        sql.NVarChar(20),       chunk.domain)
    .input('chunk_kind',    sql.NVarChar(20),       chunk.kind)
    .input('heading',       sql.NVarChar(400),      chunk.heading || null)
    .input('citation',      sql.NVarChar(400),      chunk.citation || null)
    .input('chunk_text',    sql.NVarChar(sql.MAX),  chunk.text)
    .input('embedding',     sql.NVarChar(sql.MAX),  chunk.embedding)
    .input('char_count',    sql.Int,                chunk.text.length)
    .input('token_estimate',sql.Int,                Math.ceil(chunk.text.length / 4))
    .input('ingest_run_id', sql.Int,                runId)
    .query(`
      MERGE smwe_chunks AS target
      USING (VALUES (@chunk_id)) AS source (chunk_id) ON target.chunk_id = source.chunk_id
      WHEN MATCHED THEN UPDATE SET
        chunk_text     = @chunk_text,
        embedding      = CAST(@embedding AS VECTOR(1024)),
        heading        = @heading,
        citation       = @citation,
        char_count     = @char_count,
        token_estimate = @token_estimate,
        ingest_run_id  = @ingest_run_id,
        updated_at     = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (chunk_id, source_file, module_code, domain, chunk_kind, heading, citation,
         chunk_text, embedding, char_count, token_estimate, ingest_run_id)
      VALUES
        (@chunk_id, @source_file, @module_code, @domain, @chunk_kind, @heading, @citation,
         @chunk_text, CAST(@embedding AS VECTOR(1024)), @char_count, @token_estimate, @ingest_run_id);
    `);
}

async function ingestFile(pool, filePath) {
  const filename   = path.basename(filePath);
  if (FILE_MATCH && !filename.includes(FILE_MATCH)) return { skipped: true };

  console.log(`\n[ingest] Processing: ${filename}`);
  const content    = fs.readFileSync(filePath, 'utf8');
  const domain     = detectDomain(filename);
  const moduleCode = detectModuleCode(filename);

  const chunks = chunkMarkdown(content, { sourceFile: filename, domain, moduleCode });
  console.log(`[ingest]   Chunks: ${chunks.length}, domain: ${domain}, module: ${moduleCode}`);

  if (DRY_RUN) {
    chunks.forEach((c, i) => console.log(`  [${i+1}] ${c.kind} | ${c.heading || '(no heading)'} | ${c.text.length} chars`));
    return { chunks: chunks.length, added: 0, updated: 0 };
  }

  const runId = await getOrCreateRun(pool, filename);
  let added = 0, updated = 0;

  for (const chunk of chunks) {
    // Check if exists
    const { recordset } = await pool.request()
      .input('chunk_id', sql.NVarChar(64), chunk.chunkId)
      .query('SELECT id FROM smwe_chunks WHERE chunk_id = @chunk_id');

    chunk.embedding = await embedOne(chunk.text);

    await upsertChunk(pool, runId, chunk);
    if (recordset.length > 0) updated++; else added++;
    process.stdout.write('.');
  }
  console.log(`\n[ingest]   Done: +${added} added, ~${updated} updated`);

  // Mark run complete
  await pool.request()
    .input('id',      sql.Int, runId)
    .input('added',   sql.Int, added)
    .input('updated', sql.Int, updated)
    .query(`UPDATE smwe_ingest_runs SET status='done', chunks_added=@added, chunks_updated=@updated WHERE id=@id`);

  return { chunks: chunks.length, added, updated };
}

async function main() {
  console.log('[ingest] SMWE Knowledge Base ingestion' + (DRY_RUN ? ' (DRY RUN)' : ''));

  // Collect files
  const files = [];
  for (const source of SOURCES) {
    const dir   = path.dirname(source.glob);
    const pat   = path.basename(source.glob);
    const regex = new RegExp('^' + pat.replace(/\*/g, '.*') + '$');
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir)
        .filter(f => regex.test(f))
        .forEach(f => files.push(path.join(dir, f)));
    }
  }

  console.log(`[ingest] Files found: ${files.length}`);

  const pool   = DRY_RUN ? null : await getPool();
  let total    = { chunks: 0, added: 0, updated: 0 };

  for (const file of files) {
    const result = await ingestFile(pool, file);
    if (!result.skipped) {
      total.chunks  += result.chunks;
      total.added   += result.added;
      total.updated += result.updated;
    }
  }

  console.log(`\n[ingest] Complete. Total chunks: ${total.chunks}, added: ${total.added}, updated: ${total.updated}`);
  if (!DRY_RUN) process.exit(0);
}

main().catch(err => {
  console.error('[ingest] Fatal:', err.message);
  process.exit(1);
});
