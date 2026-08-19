// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const sql  = require('mssql');

const DRY_RUN    = process.argv.includes('--dry-run');
const FILE_MATCH = (() => {
  const idx = process.argv.indexOf('--file');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const DB_CONFIG = {
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt:                process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    enableArithAbort:       true,
  },
  pool: { max: 3, min: 0, idleTimeoutMillis: 15000 },
};

async function run() {
  if (!process.env.DB_SERVER) {
    console.error('[migrate] DB_SERVER not set');
    process.exit(1);
  }
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql')).sort()
    .filter(f => !FILE_MATCH || f.startsWith(FILE_MATCH));
  if (files.length === 0) { console.log('[migrate] No files found'); process.exit(0); }
  console.log('[migrate] Found ' + files.length + ' migration(s):');
  files.forEach(f => console.log('  -', f));
  if (DRY_RUN) {
    for (const file of files) {
      console.log(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    }
    return;
  }
  let pool;
  try { pool = await sql.connect(DB_CONFIG); }
  catch (err) { console.error('[migrate] Connection failed:', err.message); process.exit(1); }
  let ok = 0, failed = 0;
  for (const file of files) {
    const batches = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      .split(/^\s*GO\s*$/im).map(b => b.trim()).filter(b => b.length > 0);
    try {
      for (const batch of batches) await pool.request().query(batch);
      console.log('[migrate] OK ' + file); ok++;
    } catch (err) { console.error('[migrate] FAIL ' + file + ':', err.message); failed++; }
  }
  await pool.close();
  console.log('[migrate] Done - ' + ok + ' succeeded, ' + failed + ' failed.');
  if (failed > 0) process.exit(1);
}
run().catch(err => { console.error('[migrate] Error:', err.message); process.exit(1); });