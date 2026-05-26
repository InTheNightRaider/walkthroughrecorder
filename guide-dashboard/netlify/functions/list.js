// netlify/functions/list.js
// GET /api/guides — returns all published guides sorted by uploadedAt desc

import { getStore } from '@netlify/blobs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const indexStore = getStore('guides-index');

  try {
    const { blobs } = await indexStore.list();
    const guides = await Promise.all(
      blobs.map(async ({ key }) => {
        try {
          const raw = await indexStore.get(key, { type: 'text' });
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })
    );

    const sorted = guides
      .filter(Boolean)
      .sort((a, b) => (b.uploadedAt || '') > (a.uploadedAt || '') ? 1 : -1);

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ guides: sorted }),
    };
  } catch (e) {
    console.error('[list]', e);
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
