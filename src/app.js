// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
'use strict';

/**
 * app.js — SMWE Express application
 *
 * One core, two doors:
 *   Web door  → POST /api/ask          (credit-metered, Entra External ID auth)
 *   MCP door  → mcp/server.js          (read-only, shared-secret, separate process)
 *
 * Health:  GET /health
 * Version: GET /api/version
 */

require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');

const askRouter  = require('./routes/ask');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── Security middleware ──────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin:  process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json({ limit: '64kb' }));

// Rate limit — 100 req/min per IP (C0 anonymous callers)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'too_many_requests' },
});
app.use('/api/', limiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', agent: 'SMWE', version: '1.0.0', ts: new Date().toISOString() });
});

app.get('/api/version', (_req, res) => {
  res.json({
    agent:   'Swiss Mobility & Workforce Expert',
    version: '1.0.0',
    domains: ['immigration','global_mobility','cross_border','social_security','dta','workforce_compliance'],
    disclaimer: 'SMWE does not provide legal advice, tax advice, or immigration filing services.',
  });
});

app.use('/api/ask', askRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[app] Unhandled error:', err.message);
  res.status(500).json({ error: 'internal_error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[smwe] API server listening on port ${PORT}`);
  console.log('[smwe] MCP server: run "node mcp/server.js" separately (or MCP_HTTP=1 for HTTP transport)');
});

module.exports = app;
