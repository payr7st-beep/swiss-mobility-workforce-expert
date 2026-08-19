// Copyright (c) 2024-2026 SevenSprings Technology AG, Switzerland. All rights reserved.
'use strict';

/**
 * lib/chunker.js — SMWE Markdown chunker
 *
 * Splits KB modules and rule sets into semantically coherent chunks for RAG.
 * Extracts: statutory citations, headings, tables (as prose), rule blocks.
 *
 * Mirrors SPE lib/chunker.js adapted for SMWE domain vocabulary.
 */

const crypto = require('crypto');

const MAX_CHUNK_CHARS  = 1200;
const MIN_CHUNK_CHARS  = 80;

// SMWE citation patterns
const CITATION_RE = /\b(Art\.\s*\d+[\w§]*|SR\s*[\d.]+|CELEX\s*[\w]+|AIG|VZAE|AFMP|EntsG|OR\s*Art\.|ArG|AVG|KS\d+[A-Z]?|DBA|AHVG|UVG|BVG|IVG|EOG|AVIG)\b/gi;

/**
 * Generate a deterministic chunk ID from source + content hash.
 */
function chunkId(sourceFile, offset, text) {
  const hash = crypto.createHash('sha256')
    .update(`${sourceFile}:${offset}:${text.slice(0, 100)}`)
    .digest('hex')
    .slice(0, 16);
  return `smwe:${hash}`;
}

/**
 * Extract the first citation reference found in a block of text.
 */
function extractCitation(text) {
  const matches = text.match(CITATION_RE);
  if (!matches) return null;
  return [...new Set(matches)].slice(0, 3).join(', ');
}

/**
 * Detect chunk kind from content.
 */
function detectKind(text) {
  if (/^\|/.test(text.trim()))          return 'table';
  if (/^```/.test(text.trim()))         return 'rule';
  if (/^#{1,3}\s/.test(text.trim()))    return 'heading';
  if (/\bArt\.\s*\d+/.test(text))      return 'rule';
  return 'text';
}

/**
 * Split markdown into chunks, preserving headings as context.
 *
 * @param {string} markdown
 * @param {object} opts
 * @param {string} opts.sourceFile
 * @param {string} opts.domain
 * @param {string} opts.moduleCode
 * @returns {Array<Chunk>}
 */
function chunkMarkdown(markdown, opts = {}) {
  const { sourceFile = 'unknown', domain = 'general', moduleCode = 'general' } = opts;
  const lines   = markdown.split('\n');
  const chunks  = [];

  let currentHeading = null;
  let buffer         = [];
  let offset         = 0;

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text.length < MIN_CHUNK_CHARS) { buffer = []; return; }

    // Split large blocks
    if (text.length > MAX_CHUNK_CHARS) {
      const subChunks = splitLarge(text, currentHeading);
      subChunks.forEach((sub, i) => {
        chunks.push({
          chunkId:    chunkId(sourceFile, offset + i, sub),
          sourceFile,
          moduleCode,
          domain,
          kind:       detectKind(sub),
          heading:    currentHeading,
          citation:   extractCitation(sub),
          text:       sub,
          embedding:  null,
        });
      });
    } else {
      chunks.push({
        chunkId:    chunkId(sourceFile, offset, text),
        sourceFile,
        moduleCode,
        domain,
        kind:       detectKind(text),
        heading:    currentHeading,
        citation:   extractCitation(text),
        text,
        embedding:  null,
      });
    }
    buffer = [];
    offset++;
  };

  for (const line of lines) {
    // New heading → flush current buffer, update heading context
    if (/^#{1,4}\s/.test(line)) {
      if (buffer.length > 0) flush();
      currentHeading = line.replace(/^#+\s/, '').trim();
      buffer = [line];
      continue;
    }

    // Table rows — keep together as one chunk
    if (line.startsWith('|')) {
      buffer.push(line);
      continue;
    }

    // Code fences — keep together
    if (line.startsWith('```')) {
      buffer.push(line);
      if (buffer.filter(l => l.startsWith('```')).length === 2) flush();
      continue;
    }

    // Blank line = paragraph boundary → flush if buffer is substantial
    if (line.trim() === '') {
      if (buffer.join('').trim().length > MIN_CHUNK_CHARS) flush();
      continue;
    }

    buffer.push(line);
    // Flush if approaching max size
    if (buffer.join('\n').length > MAX_CHUNK_CHARS) flush();
  }

  if (buffer.length > 0) flush();
  return chunks;
}

function splitLarge(text, heading) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const result = [];
  let current  = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > MAX_CHUNK_CHARS && current.length > 0) {
      result.push(current.trim());
      current = '';
    }
    current += sentence + ' ';
  }
  if (current.trim()) result.push(current.trim());
  return result.length > 0 ? result : [text.slice(0, MAX_CHUNK_CHARS)];
}

module.exports = { chunkMarkdown, extractCitation, chunkId };
