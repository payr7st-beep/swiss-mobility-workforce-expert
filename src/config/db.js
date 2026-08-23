// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
// Proprietary and confidential. Unauthorised use prohibited. See LICENSE.
'use strict';
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
let _connecting = null;
async function getPool() {
  if (_pool) return _pool;
  if (!_connecting) {
    _connecting = sql.connect(config).then(pool => {
      _pool = pool;
      _connecting = null;
      console.log('[db] Connected to Azure SQL:', process.env.DB_SERVER);
      return pool;
    }).catch(err => {
      _connecting = null;
      throw err;
    });
  }
  return _connecting;
}
module.exports = { getPool, sql };
