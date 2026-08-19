// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
'use strict';

/**
 * services/creditService.js — SMWE credit ledger operations
 *
 * Query classes and costs:
 *   C0 — exact lookup / figure  — 1 credit  (anonymous-eligible)
 *   C1 — single-domain question — 2 credits
 *   C2 — cross-domain advisory  — 5 credits
 *   C3 — document analysis      — 10 credits
 */

const { getPool, sql } = require('../config/db');

const CREDIT_COSTS = { C0: 1, C1: 2, C2: 5, C3: 10 };

/**
 * Derive current credit balance for a customer from the append-only ledger.
 * Balance = SUM of all delta events; never goes below 0.
 */
async function getBalance(customerId) {
  const pool = await getPool();
  const { recordset } = await pool.request()
    .input('customer_id', sql.Int, customerId)
    .query(`
      SELECT ISNULL(SUM(delta), 0) AS balance
        FROM smwe_credit_events
       WHERE customer_id = @customer_id
    `);
  return Math.max(0, recordset[0].balance);
}

/**
 * Count C1+C2+C3 queries today (UTC) for daily limit enforcement.
 */
async function getDailySpend(customerId) {
  const pool = await getPool();
  const { recordset } = await pool.request()
    .input('customer_id', sql.Int, customerId)
    .query(`
      SELECT ISNULL(SUM(ABS(delta)), 0) AS spent_today
        FROM smwe_credit_events
       WHERE customer_id    = @customer_id
         AND event_type     IN ('spend_c1','spend_c2','spend_c3')
         AND created_at    >= CAST(GETUTCDATE() AS DATE)
    `);
  return recordset[0].spent_today;
}

/**
 * Atomically spend credits. Returns { success, balance, error }.
 * Uses a serialisable transaction to prevent race conditions.
 */
async function spendCredits(customerId, queryClass, referenceId) {
  const cost = CREDIT_COSTS[queryClass];
  if (!cost) return { success: false, error: `unknown_query_class:${queryClass}` };

  const pool = await getPool();
  const txn  = new sql.Transaction(pool);

  try {
    await txn.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const req = new sql.Request(txn);

    const { recordset } = await req
      .input('customer_id', sql.Int, customerId)
      .query(`SELECT ISNULL(SUM(delta), 0) AS balance FROM smwe_credit_events WHERE customer_id = @customer_id`);

    const balance = Math.max(0, recordset[0].balance);
    if (balance < cost) {
      await txn.rollback();
      return { success: false, balance, error: 'insufficient_credits' };
    }

    await new sql.Request(txn)
      .input('customer_id',  sql.Int,         customerId)
      .input('delta',        sql.Int,         -cost)
      .input('event_type',   sql.NVarChar(30), `spend_${queryClass.toLowerCase()}`)
      .input('query_class',  sql.NVarChar(5),  queryClass)
      .input('reference_id', sql.NVarChar(100), referenceId || null)
      .query(`
        INSERT INTO smwe_credit_events (customer_id, delta, event_type, query_class, reference_id)
        VALUES (@customer_id, @delta, @event_type, @query_class, @reference_id)
      `);

    await txn.commit();
    return { success: true, balance: balance - cost };

  } catch (err) {
    await txn.rollback().catch(() => {});
    throw err;
  }
}

/**
 * Credit a customer (pack purchase, daily reset, admin adjustment).
 */
async function attachCredits(customerId, amount, eventType, referenceId) {
  const pool = await getPool();
  await pool.request()
    .input('customer_id',  sql.Int,          customerId)
    .input('delta',        sql.Int,          amount)
    .input('event_type',   sql.NVarChar(30), eventType || 'admin_adjust')
    .input('reference_id', sql.NVarChar(100), referenceId || null)
    .query(`
      INSERT INTO smwe_credit_events (customer_id, delta, event_type, reference_id)
      VALUES (@customer_id, @delta, @event_type, @reference_id)
    `);
}

module.exports = { getBalance, getDailySpend, spendCredits, attachCredits, CREDIT_COSTS };
