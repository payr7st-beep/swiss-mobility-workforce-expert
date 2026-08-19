// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
'use strict';

/**
 * middleware/authExternal.js — Entra External ID (CIAM) token validation
 *
 * Validates Bearer JWTs issued by the SMWE Entra External ID tenant.
 * Mirrors SPE middleware/authExternal.js.
 *
 * Exports:
 *   requireCustomer   — returns 401 if no valid token
 *   optionalCustomer  — populates req.customer if token present; never 401
 */

const jwt     = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');
const { getPool, sql } = require('../config/db');

const TENANT_ID = process.env.EXT_TENANT_ID;
const CLIENT_ID = process.env.EXT_CLIENT_ID;
const ISSUER    = process.env.EXT_AUTHORITY ||
  `https://${process.env.EXT_TENANT_SUBDOMAIN}.ciamlogin.com/${TENANT_ID}/v2.0`;

const jwksClient = jwksRsa({
  jwksUri: `${ISSUER}/.well-known/openid-configuration`.replace('/v2.0', '') + '/discovery/v2.0/keys',
  cache:   true,
  rateLimit: true,
});

function getKey(header, callback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

async function validateToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);

  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      audience: CLIENT_ID,
      issuer:   ISSUER,
      algorithms: ['RS256'],
    }, (err, decoded) => {
      if (err) reject(err);
      else     resolve(decoded);
    });
  });
}

async function resolveCustomer(oid, email, displayName) {
  const pool = await getPool();

  // Auto-provision on first login (mirrors SPE pattern)
  const { recordset } = await pool.request()
    .input('oid', sql.NVarChar(64), oid)
    .query('SELECT id, plan, daily_limit FROM smwe_customers WHERE entra_oid = @oid');

  if (recordset.length > 0) return recordset[0];

  // New customer — insert with free plan defaults
  const result = await pool.request()
    .input('oid',          sql.NVarChar(64),  oid)
    .input('email',        sql.NVarChar(254), email || '')
    .input('display_name', sql.NVarChar(200), displayName || '')
    .query(`
      INSERT INTO smwe_customers (entra_oid, email, display_name)
      OUTPUT INSERTED.id, INSERTED.plan, INSERTED.daily_limit
      VALUES (@oid, @email, @display_name)
    `);
  return result.recordset[0];
}

async function authenticate(req, res, required) {
  try {
    const decoded  = await validateToken(req);
    if (!decoded) {
      if (required) return res.status(401).json({ error: 'authentication_required' });
      return false;
    }

    const customer = await resolveCustomer(
      decoded.oid || decoded.sub,
      decoded.email || decoded.preferred_username,
      decoded.name,
    );

    req.customer = { ...customer, oid: decoded.oid || decoded.sub };
    return true;
  } catch (err) {
    if (required) return res.status(401).json({ error: 'invalid_token', detail: err.message });
    return false;
  }
}

const requireCustomer  = (req, res, next) => authenticate(req, res, true).then(ok => ok && next());
const optionalCustomer = (req, res, next) => authenticate(req, res, false).then(() => next());

module.exports = { requireCustomer, optionalCustomer };
