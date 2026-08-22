// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
'use strict';

/**
 * services/embeddings.js — Multilingual embedding provider (SMWE)
 *
 * Default: BAAI/bge-m3 via Hugging Face Inference API (1024-dim, multilingual DE/FR/EN/IT)
 * Fallback providers: Ollama (local), OpenAI / Azure OpenAI text-embedding-3-small (dimensions=1024)
 *
 * Output: Float32Array of length EMBEDDINGS_DIM (default 1024)
 *
 * Provider env var (EMBEDDINGS_PROVIDER):
 *   huggingface  — HF Inference API (default); requires HF_TOKEN
 *   openai       — OpenAI text-embedding-3-small; requires OPENAI_API_KEY
 *   azure_openai — Azure OpenAI; requires AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_KEY + AZURE_OPENAI_EMBED_DEPLOYMENT
 *   ollama       — local Ollama; requires OLLAMA_URL + OLLAMA_MODEL
 */

require('dotenv').config();

const PROVIDER = process.env.EMBEDDINGS_PROVIDER || 'huggingface';
const MODEL    = process.env.EMBEDDINGS_MODEL    || 'BAAI/bge-m3';
const DIM      = parseInt(process.env.EMBEDDINGS_DIM || '1024', 10);
const HF_TOKEN = process.env.HF_TOKEN;

// ─── Hugging Face Inference API (with model-loading retry) ───────────────────

async function embedHuggingFace(texts) {
  const url = `https://api-inference.huggingface.co/models/${MODEL}`;
  const MAX_WAIT_MS = 120_000; // 2 min max for model cold-start
  const started     = Date.now();

  while (true) {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
    });

    if (res.ok) {
      const data = await res.json();
      // HF returns array of arrays; normalise to Float32Array[]
      return data.map(vec => new Float32Array(vec));
    }

    // 503 = model still loading — respect estimated_time and retry
    if (res.status === 503) {
      let waitMs = 10_000;
      try {
        const body = await res.json();
        if (body.estimated_time) waitMs = Math.min(body.estimated_time * 1000, 30_000);
        console.error(`[embeddings] HF model loading — waiting ${Math.round(waitMs / 1000)}s`);
      } catch (_) { /* ignore JSON parse errors */ }

      if (Date.now() - started + waitMs > MAX_WAIT_MS) {
        throw new Error('HuggingFace model did not load within 2 minutes. Try again or switch provider.');
      }
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    // Any other error — surface clearly
    const body = await res.text();
    throw new Error(`HuggingFace embeddings error: ${res.status} ${body}`);
  }
}

// ─── OpenAI (text-embedding-3-small, dimensions=1024) ────────────────────────

async function embedOpenAI(texts) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  const oaiModel = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: oaiModel, input: texts, dimensions: DIM }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings error: ${res.status} ${await res.text()}`);
  const { data } = await res.json();
  return data.map(d => new Float32Array(d.embedding));
}

// ─── Azure OpenAI (text-embedding-3-small with dimensions=1024) ──────────────

async function embedAzureOpenAI(texts) {
  const endpoint   = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey     = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_EMBED_DEPLOYMENT || 'text-embedding-3-small';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION     || '2024-02-01';
  if (!endpoint || !apiKey) throw new Error('AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY must be set');

  const url = `${endpoint}/openai/deployments/${deployment}/embeddings?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'api-key':      apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: texts, dimensions: DIM }),
  });
  if (!res.ok) throw new Error(`Azure OpenAI embeddings error: ${res.status} ${await res.text()}`);
  const { data } = await res.json();
  return data.map(d => new Float32Array(d.embedding));
}

// ─── Ollama (local fallback) ──────────────────────────────────────────────────

async function embedOllama(texts) {
  const url   = process.env.OLLAMA_URL   || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'nomic-embed-text';
  const results = [];
  for (const text of texts) {
    const res  = await fetch(`${url}/api/embeddings`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok) throw new Error(`Ollama embedding error: ${res.status}`);
    const { embedding } = await res.json();
    results.push(new Float32Array(embedding));
  }
  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Embed one or more texts.
 * @param {string|string[]} input
 * @returns {Promise<Float32Array[]>}
 */
async function embed(input) {
  const texts = Array.isArray(input) ? input : [input];
  switch (PROVIDER) {
    case 'huggingface':  return embedHuggingFace(texts);
    case 'openai':       return embedOpenAI(texts);
    case 'azure_openai': return embedAzureOpenAI(texts);
    case 'ollama':       return embedOllama(texts);
    default:             throw new Error(`Unknown embeddings provider: ${PROVIDER}`);
  }
}

/**
 * Embed a single text and return the vector as a JSON string for Azure SQL VECTOR insert.
 * Azure SQL expects: '[0.123, 0.456, ...]'
 */
async function embedOne(text) {
  const [vec] = await embed([text]);
  return JSON.stringify(Array.from(vec));
}

module.exports = { embed, embedOne, DIM };
