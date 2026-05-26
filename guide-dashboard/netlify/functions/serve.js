// netlify/functions/serve.js
// GET /guides/:slug         → serves index.html for that guide
// GET /guides/:slug/*       → serves the requested file from Blobs

import { getStore } from '@netlify/blobs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'X-Frame-Options': 'ALLOWALL',
  'Content-Security-Policy': 'frame-ancestors *',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain',
  '.md':   'text/plain',
  '.toml': 'text/plain',
};

function extOf(path) {
  const m = path.match(/(\.[^./]+)$/);
  return m ? m[1].toLowerCase() : '';
}

function isBinary(ext) {
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'].includes(ext);
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  // Parse slug and file path from: /guides/<slug>[/<file>]
  const raw = event.path.replace(/^\/guides\//, '');
  const slashIdx = raw.indexOf('/');
  const slug = slashIdx === -1 ? raw : raw.slice(0, slashIdx);
  const filePath = slashIdx === -1 ? 'index.html' : raw.slice(slashIdx + 1) || 'index.html';

  if (!slug) {
    return { statusCode: 404, headers: CORS, body: 'Not found' };
  }

  const fileStore = getStore('guide-files');
  const blobKey   = `${slug}/${filePath}`;

  try {
    const ext        = extOf(filePath);
    const binary     = isBinary(ext);
    const contentType = MIME[ext] || 'application/octet-stream';

    if (binary) {
      const buf = await fileStore.get(blobKey, { type: 'arrayBuffer' });
      if (!buf) return { statusCode: 404, headers: CORS, body: 'File not found' };
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': contentType },
        body: Buffer.from(buf).toString('base64'),
        isBase64Encoded: true,
      };
    } else {
      const text = await fileStore.get(blobKey, { type: 'text' });
      if (text === null) return { statusCode: 404, headers: CORS, body: 'File not found' };
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': contentType },
        body: text,
      };
    }
  } catch (e) {
    console.error('[serve]', blobKey, e.message);
    return { statusCode: 500, headers: CORS, body: 'Server error: ' + e.message };
  }
};
