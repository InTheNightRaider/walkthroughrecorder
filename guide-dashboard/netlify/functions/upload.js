// netlify/functions/upload.js
// POST /api/upload — accepts multipart form with file + title + slug + description
// Unpacks the ZIP, stores each file in Netlify Blobs, updates the guide index.

import { getStore } from '@netlify/blobs';
import multipart from 'lambda-multipart-parser';
import JSZip from 'jszip';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function ok(body) {
  return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function err(code, msg) {
  return { statusCode: code, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: msg }) };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  let fields, files;
  try {
    const parsed = await multipart.parse(event);
    fields = parsed;
    files = parsed.files || [];
  } catch (e) {
    return err(400, 'Could not parse multipart form: ' + e.message);
  }

  const title       = (fields.title || '').trim();
  const slug        = (fields.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
  const description = (fields.description || '').trim();

  if (!title)      return err(400, 'title is required');
  if (!slug)       return err(400, 'slug is required');
  if (files.length === 0) return err(400, 'No file uploaded');

  const zipFile = files.find(f => f.filename && f.filename.endsWith('.zip')) || files[0];
  if (!zipFile) return err(400, 'No zip file found in upload');

  const fileStore  = getStore('guide-files');
  const indexStore = getStore('guides-index');

  try {
    // If slug already exists, delete old files first (replace semantics)
    const existing = await indexStore.get(slug, { type: 'json' }).catch(() => null);
    if (existing && existing.files) {
      await Promise.allSettled(
        existing.files.map(path => fileStore.delete(`${slug}/${path}`))
      );
    }

    // Unpack ZIP
    const zip = await JSZip.loadAsync(Buffer.from(zipFile.content, 'binary'));
    const filePaths = [];
    let manifest = null;

    const entries = Object.entries(zip.files).filter(([, f]) => !f.dir);

    await Promise.all(entries.map(async ([path, zipEntry]) => {
      const content = await zipEntry.async('nodebuffer');
      await fileStore.set(`${slug}/${path}`, content);
      filePaths.push(path);

      if (path === 'walkthrough.json') {
        try { manifest = JSON.parse(content.toString('utf8')); } catch {}
      }
    }));

    // Update index entry
    const indexEntry = {
      slug,
      title,
      description,
      stepCount: manifest?.stepCount || null,
      projectId: manifest?.projectId || null,
      files: filePaths,
      uploadedAt: new Date().toISOString(),
    };
    await indexStore.set(slug, JSON.stringify(indexEntry));

    return ok({ ok: true, slug, fileCount: filePaths.length });
  } catch (e) {
    console.error('[upload]', e);
    return err(500, e.message);
  }
};
