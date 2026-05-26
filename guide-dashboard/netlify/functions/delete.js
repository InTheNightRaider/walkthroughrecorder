// netlify/functions/delete.js
// DELETE /api/guides/:slug — removes a guide and all its stored files

import { getStore } from '@netlify/blobs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function ok(body)     { return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
function err(c, msg)  { return { statusCode: c,   headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: msg }) }; }

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'DELETE') return err(405, 'Method not allowed');

  // Extract slug from path: /api/guides/<slug>  or  /.netlify/functions/delete/<slug>
  const parts = event.path.split('/').filter(Boolean);
  const slug = parts[parts.length - 1];
  if (!slug || slug === 'delete' || slug === 'guides') return err(400, 'slug required');

  const indexStore = getStore('guides-index');
  const fileStore  = getStore('guide-files');

  try {
    const raw = await indexStore.get(slug, { type: 'text' }).catch(() => null);
    if (!raw) return err(404, 'Guide not found');

    const entry = JSON.parse(raw);

    // Delete all files
    await Promise.allSettled(
      (entry.files || []).map(path => fileStore.delete(`${slug}/${path}`))
    );

    // Remove index entry
    await indexStore.delete(slug);

    return ok({ ok: true, slug });
  } catch (e) {
    console.error('[delete]', e);
    return err(500, e.message);
  }
};
