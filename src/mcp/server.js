// Copyright (c) 2024-2026 SevenSprings Technology AG
// mcp/server.js — Standalone MCP HTTP server (stateless direct-dispatch, no SDK transport)
// Legal boundary: informational only; no legal/tax/immigration filings.
'use strict';

const express = require('express');
const { retrieve, getPermit, getTreaty } = require('../services/retrieval');

const PORT       = parseInt(process.env.MCP_PORT || process.env.PORT || '3000', 10);
const MCP_SECRET = process.env.MCP_SECRET;

// ── Tool schemas (JSON Schema, as required by MCP tools/list) ────────────────
const TOOLS = [
  {
    name: 'smwe_lookup',
    description:
      'General Swiss mobility & workforce knowledge base lookup. ' +
      'Returns the most relevant chunks from the SMWE knowledge base for the given query. ' +
      'Optionally filter by domain: immigration | global_mobility | cross_border | social_security | dta | workforce.',
    inputSchema: {
      type: 'object',
      properties: {
        query:  { type: 'string',  description: 'Natural-language question or topic to look up' },
        domain: { type: 'string',
                  enum: ['immigration','global_mobility','cross_border','social_security','dta','workforce'],
                  description: 'Optional domain filter' },
        top_k:  { type: 'integer', minimum: 1, maximum: 10, default: 5,
                  description: 'Maximum number of chunks to return (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'smwe_permit',
    description:
      'Look up Swiss work and residence permit information. ' +
      'Returns permit types, eligibility criteria, quotas, and procedural guidance from the SMWE knowledge base. ' +
      'DISCLAIMER: For informational purposes only — not legal advice or immigration filing assistance.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string',  description: 'Question about Swiss work or residence permits' },
        top_k: { type: 'integer', minimum: 1, maximum: 10, default: 5,
                 description: 'Maximum number of chunks to return (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'smwe_treaty',
    description:
      'Look up Swiss social security agreements (totalisation treaties) and double taxation agreements (DTAs). ' +
      'Returns applicable treaty provisions, coverage rules, and certificate-of-coverage guidance. ' +
      'DISCLAIMER: For informational purposes only — not legal or tax advice, and not a tax filing service.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string',  description: 'Question about Swiss social security or tax treaties' },
        top_k: { type: 'integer', minimum: 1, maximum: 10, default: 5,
                 description: 'Maximum number of chunks to return (default 5)' },
      },
      required: ['query'],
    },
  },
];

// ── Tool handlers ────────────────────────────────────────────────────────────
async function callLookup({ query, domain, top_k = 5 }) {
  const { chunks } = await retrieve(query, { domain, topK: top_k });
  if (!chunks.length) return [{ type: 'text', text: 'No relevant content found for this query.' }];
  const body = chunks.map((c, i) =>
    `### Result ${i + 1} (score=${c.score.toFixed(3)}, domain=${c.domain})\n${c.text}`
  ).join('\n\n---\n\n');
  return [{ type: 'text', text: body }];
}

async function callPermit({ query, top_k = 5 }) {
  const { chunks } = await getPermit(query, { topK: top_k });
  if (!chunks.length) return [{ type: 'text', text: 'No permit information found for this query.' }];
  const hdr = '> **Disclaimer:** The following is general information only and does not constitute legal advice or an immigration filing.\n\n';
  const body = chunks.map((c, i) =>
    `### Permit Info ${i + 1} (score=${c.score.toFixed(3)})\n${c.text}`
  ).join('\n\n---\n\n');
  return [{ type: 'text', text: hdr + body }];
}

async function callTreaty({ query, top_k = 5 }) {
  const { chunks } = await getTreaty(query, { topK: top_k });
  if (!chunks.length) return [{ type: 'text', text: 'No treaty information found for this query.' }];
  const hdr = '> **Disclaimer:** The following is general information only and does not constitute legal or tax advice, and SMWE does not prepare tax filings.\n\n';
  const body = chunks.map((c, i) =>
    `### Treaty Info ${i + 1} (score=${c.score.toFixed(3)}, domain=${c.domain})\n${c.text}`
  ).join('\n\n---\n\n');
  return [{ type: 'text', text: hdr + body }];
}

const HANDLERS = { smwe_lookup: callLookup, smwe_permit: callPermit, smwe_treaty: callTreaty };

// ── Stateless MCP JSON-RPC dispatcher ───────────────────────────────────────
async function dispatchMcp(body) {
  const { jsonrpc, id, method, params } = body || {};

  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id: id || null, error: { code: -32600, message: 'Invalid JSON-RPC request' } };
  }

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: params && params.protocolVersion ? params.protocolVersion : '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'SMWE-MCP', version: '1.0.0' },
        },
      };

    case 'notifications/initialized':
      return null;  // notification — no response

    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };

    case 'tools/call': {
      const { name, arguments: args } = params || {};
      const handler = HANDLERS[name];
      if (!handler) {
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } };
      }
      try {
        const content = await handler(args || {});
        return { jsonrpc: '2.0', id, result: { content } };
      } catch (err) {
        console.error(`[mcp] Tool ${name} error:`, err);
        // Return error as tool content so the MCP client sees it rather than a protocol error
        return {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: `[SMWE-ERROR] ${name} failed: ${err.message}` }] },
        };
      }
    }

    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

// ── Express app ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '64kb' }));

// Health — unauthenticated
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', agent: 'SMWE-MCP', version: '1.0.0' });
});

// MCP secret guard
app.use('/mcp', (req, res, next) => {
  if (!MCP_SECRET || req.headers['x-mcp-secret'] !== MCP_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

// MCP endpoint — fully stateless: each POST is its own complete transaction
app.post('/mcp', async (req, res) => {
  try {
    const response = await dispatchMcp(req.body);
    if (response === null) {
      return res.status(202).end();  // notification acknowledged
    }
    // Claude's MCP client sends Accept: application/json, text/event-stream
    // Respond as SSE when requested; plain JSON otherwise.
    const accept = req.headers['accept'] || '';
    if (accept.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.write(`data: ${JSON.stringify(response)}\n\n`);
      res.end();
    } else {
      res.json(response);
    }
  } catch (err) {
    console.error('[mcp] Dispatcher error:', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

app.listen(PORT, () => {
  console.log(`[mcp] SMWE-MCP (stateless direct-dispatch) listening on port ${PORT}`);
});
