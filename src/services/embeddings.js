// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
'use strict';

/**
 * services/embeddings.js — Multilingual embedding provider (SMWE)
 *
 * Default: BAAI/bge-m3 via Hugging Face Inference API (1024-dim, multilingual DE/FR/EN/IT)
 * Fallback providers: Ollama (local), OpenAI text-embedding-3-large, Voyage AI
 *
 * Output: Float32Array of length EMBEDDINGS_DIM (default 1024)
 */

require('dotenv').config();

const PROVIDER = process.env.EMBEDDINGS_PROVIDER || 'huggingface';
const MODEL    = process.env.EMBEDDINGS_MODEL    || 'BAAI/bge-m3';
const DIM      = parseInt(process.env.EMBEDDINGS_DIM || '1024', 10);
const HF_TOKEN = process.env.HF_TOKEN;

// ─── Hugging Face Inference API ───────────────────────────────────────────────

async function embedHuggingFace(texts) {
  const url = `https://api-inference.huggingface.co/models/${MODEL}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: texts }),
  });
  if (!res.ok) throw new Error(`HuggingFace embeddings error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  // HF returns array of arrays; normalise to Float32Array[]
  return data.map(vec => new Float32Array(vec));
}

// ─── Ollama (local fallback) ──────────────────────────────────────────────────

async function embedOllama(texts) {
  const url   = process.env.OLLAMA_URL || 'http://localhost:11434';
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
    case 'huggingface': return embedHuggingFace(texts);
    case 'ollama':      return embedOllama(texts);
    default:            throw new Error(`Unknown embeddings provider: ${PROVIDER}`);
  }
}

/**
 * Embed a single text and return the vector as a Buffer for Azure SQL VECTOR insert.
 * Azure SQL expects a JSON array string: '[0.123, 0.456, ...]'
 */
async function embedOne(text) {
  const [vec] = await embed([text]);
  return JSON.stringify(Array.from(vec));
}

module.exports = { embed, embedOne, DIM };
