// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
'use strict';
require('dotenv').config();
const PROVIDER = process.env.EMBEDDINGS_PROVIDER || 'huggingface';
const MODEL    = process.env.EMBEDDINGS_MODEL    || 'BAAI/bge-m3';
const DIM      = parseInt(process.env.EMBEDDINGS_DIM || '1024', 10);
const HF_TOKEN = process.env.HF_TOKEN;

async function embedHuggingFace(texts) {
  const url = `https://api-inference.huggingface.co/models/${MODEL}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: texts }),
  });
  if (!res.ok) throw new Error(`HuggingFace embeddings error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.map(vec => new Float32Array(vec));
}

async function embedAzureOpenAI(texts) {
  const endpoint   = process.env.AZURE_OPENAI_ENDPOINT || '';
  const apiKey     = process.env.AZURE_OPENAI_KEY      || '';
  const deployment = process.env.AZURE_OPENAI_EMBED_DEPLOYMENT || 'text-embedding-3-small';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION      || '2024-02-01';
  if (!endpoint || !apiKey) throw new Error('Azure OpenAI: AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY must be set');
  const base = endpoint.replace(/\/$/, '');
  const url  = `${base}/openai/deployments/${deployment}/embeddings?api-version=${apiVersion}`;
  const results = [];
  for (const text of texts) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, dimensions: DIM }),
    });
    if (!res.ok) throw new Error(`Azure OpenAI embeddings error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    results.push(new Float32Array(data.data[0].embedding));
  }
  return results;
}

async function embedOllama(texts) {
  const url   = process.env.OLLAMA_URL   || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'nomic-embed-text';
  const results = [];
  for (const text of texts) {
    const res = await fetch(`${url}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok) throw new Error(`Ollama embedding error: ${res.status}`);
    const { embedding } = await res.json();
    results.push(new Float32Array(embedding));
  }
  return results;
}

async function embed(input) {
  const texts = Array.isArray(input) ? input : [input];
  switch (PROVIDER) {
    case 'huggingface':  return embedHuggingFace(texts);
    case 'azure_openai': return embedAzureOpenAI(texts);
    case 'ollama':       return embedOllama(texts);
    default:             throw new Error(`Unknown embeddings provider: ${PROVIDER}`);
  }
}

async function embedOne(text) {
  const [vec] = await embed([text]);
  return JSON.stringify(Array.from(vec));
}

module.exports = { embed, embedOne, DIM };
