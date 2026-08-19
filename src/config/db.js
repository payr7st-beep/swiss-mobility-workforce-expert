// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
// Proprietary and confidential. Unauthorised use prohibited. See LICENSE.
'use strict';

/**
 * config/db.js — Azure SQL connection pool (mssql)
 *
 * Identical pattern to SPE config/db.js — one pool, lazily initialised,
 * reused across requests. VECTOR(1024) type is used for RAG chunks.
 */

require('dotenv').config();
const sql = require('mssql');

const config = {
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt:              process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    enableArithAbort:     true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let _pool = null;

async function getPool() {
  if (_pool) return _pool;
  _pool = await sql.connect(config);
  console.log('[db] Connected to Azure SQL:', process.env.DB_SERVER);
  return _pool;
}

module.exports = { getPool, sql };
