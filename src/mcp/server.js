// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
'use strict';

/**
 * mcp/server.js — SMWE MCP Door (read-only, shared-secret gated)
 *
 * Exposes three MCP tools for the Hermes agent roster and Claude:
 *   smwe_lookup   — semantic search across all SMWE domains
 *   smwe_permit   — immigration / permit classification lookup
 *   smwe_treaty   — DTA + social security agreement lookup
 *
 * Transport: stdio (default) or streamable-HTTP (MCP_HTTP=1)
 * Auth:      X-MCP-Secret header must match MCP_SECRET env var
 *
 * Usage:
 *   node mcp/server.js                   # stdio transport
 *   MCP_HTTP=1 node mcp/server.js        # HTTP transport on PORT
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { McpServer }          = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z }                  = require('zod');
const { retrieve, getPermit, getTreaty } = require('../services/retrieval');

const MCP_SECRET = process.env.MCP_SECRET || '';
const DISCLAIMER =
  'SMWE output is indicative only. Confirm with the competent authority. ' +
  'SMWE does not provide legal advice, tax advice, or immigration filing services.';

// ─── MCP server definition ────────────────────────────────────────────────────

const server = new McpServer({
  name:    'smwe',
  version: '1.0.0',
});

// ─── Tool: smwe_lookup ────────────────────────────────────────────────────────

server.tool(
  'smwe_lookup',
  {
    query: z.string().describe('The mobility/immigration/DTA question in DE, FR, EN, or IT'),
    domain: z.enum([
      'immigration','global_mobility','cross_border',
      'social_security','dta','workforce_compliance',
    ]).optional().describe('Narrow search to a specific SMWE domain'),
    top_k: z.number().int().min(1).max(10).optional().default(5),
  },
  async ({ query, domain, top_k }) => {
    const { chunks, topScore, gapFlagged } = await retrieve(query, { domain, topK: top_k });

    if (chunks.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No authoritative SMWE content found for: "${query}". ${DISCLAIMER}`,
        }],
      };
    }

    const body = chunks.map(c => {
      const cite = c.citation ? ` [${c.citation}]` : '';
      return `### ${c.heading || c.sourceFile}${cite}\n${c.text}`;
    }).join('\n\n---\n\n');

    return {
      content: [{
        type: 'text',
        text: `${body}\n\n*top_score=${topScore.toFixed(3)} gap_flagged=${gapFlagged}*\n\n${DISCLAIMER}`,
      }],
    };
  }
);

// ─── Tool: smwe_permit ────────────────────────────────────────────────────────

server.tool(
  'smwe_permit',
  {
    query: z.string().describe(
      'Permit classification question — e.g. "Which permit for EU national, 18-month contract?"'
    ),
    nationality_track: z.enum(['eu_efta','third_country','uk']).optional()
      .describe('Pre-filter by nationality track if known'),
  },
  async ({ query, nationality_track }) => {
    const domain   = 'immigration';
    const fullQuery = nationality_track
      ? `${query} [track: ${nationality_track}]`
      : query;

    const { chunks, topScore, gapFlagged } = await getPermit(fullQuery);

    if (chunks.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No permit classification data found. Consult cantonal migration office (SEM). ${DISCLAIMER}`,
        }],
      };
    }

    const permitText = chunks.map(c => {
      const cite = c.citation ? ` [${c.citation}]` : '';
      return `**${c.heading || 'Permit rule'}**${cite}\n${c.text}`;
    }).join('\n\n');

    return {
      content: [{
        type: 'text',
        text: `${permitText}\n\n*top_score=${topScore.toFixed(3)}*\n\n${DISCLAIMER}`,
      }],
    };
  }
);

// ─── Tool: smwe_treaty ────────────────────────────────────────────────────────

server.tool(
  'smwe_treaty',
  {
    query: z.string().describe(
      'DTA or social security agreement question — e.g. "183-day rule CH-DE", "A1 posting France"'
    ),
    treaty_type: z.enum(['dta','social_security','both']).optional().default('both')
      .describe('Filter by treaty type'),
    country_pair: z.string().optional()
      .describe('Country pair if known — e.g. "CH-DE", "CH-FR", "CH-US"'),
  },
  async ({ query, treaty_type, country_pair }) => {
    const fullQuery = country_pair ? `${query} ${country_pair}` : query;

    let result;
    if (treaty_type === 'dta') {
      result = await retrieve(fullQuery, { domain: 'dta' });
    } else if (treaty_type === 'social_security') {
      result = await retrieve(fullQuery, { domain: 'social_security' });
    } else {
      result = await getTreaty(fullQuery);
    }

    const { chunks, topScore, gapFlagged } = result;

    if (chunks.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No treaty data found for: "${query}". Consult ESTV/SIF for DTA, ZAS/SVA for social security. ${DISCLAIMER}`,
        }],
      };
    }

    const body = chunks.map(c => {
      const cite = c.citation ? ` [${c.citation}]` : '';
      return `**${c.heading || c.sourceFile}**${cite}\n${c.text}`;
    }).join('\n\n---\n\n');

    return {
      content: [{
        type: 'text',
        text: `${body}\n\n*top_score=${topScore.toFixed(3)} gap_flagged=${gapFlagged}*\n\n${DISCLAIMER}`,
      }],
    };
  }
);

// ─── Transport ────────────────────────────────────────────────────────────────

async function main() {
  if (process.env.MCP_HTTP === '1') {
    // Streamable HTTP transport (for Railway / App Service deployment)
    const express    = require('express');
    const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const app        = express();
    app.use(express.json());

    // Shared-secret guard
    app.use((req, res, next) => {
      if (MCP_SECRET && req.headers['x-mcp-secret'] !== MCP_SECRET) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      next();
    });

    const transport = new StreamableHTTPServerTransport({ path: '/mcp' });
    await server.connect(transport);
    app.use('/mcp', transport.requestHandler);

    const port = parseInt(process.env.PORT || '3001', 10);
    app.listen(port, () => console.log(`[mcp:smwe] HTTP transport on port ${port}`));
  } else {
    // stdio transport (default — for Claude Desktop / local testing)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[mcp:smwe] stdio transport ready');
  }
}

main().catch(err => {
  console.error('[mcp:smwe] Fatal:', err.message);
  process.exit(1);
});
