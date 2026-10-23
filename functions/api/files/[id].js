// GET / PUT /api/files/<id>: the uploaded files themselves, stored gzipped exactly as the browser sent them.
import { json, validId, readBody } from '../../../lib/store.js';

const LIMIT = 60 * 1024 * 1024;

export async function onRequestGet({ env, params }) {
  if (!validId(params.id)) return json({ error: 'bad_request' }, 400);
  const obj = await env.DATA.get(`files/${params.id}`);
  if (!obj) return json({ error: 'not_found', message: 'That file is no longer in shared storage.' }, 404);
  return new Response(obj.body, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=31536000, immutable' } });
}

export async function onRequestPut({ request, env, params, data }) {
  if (!validId(params.id)) return json({ error: 'bad_request' }, 400);
  let body;
  try {
    body = await readBody(request, LIMIT);
  } catch {
    return json({ error: 'too_large', message: 'That file is too large for shared storage (60 MB limit after compression).' }, 413);
  }
  await env.DATA.put(`files/${params.id}`, body, {
    httpMetadata: { contentType: 'application/octet-stream' },
    customMetadata: { by: String(data.user || ''), at: new Date().toISOString() },
  });
  return json({ ok: true, bytes: body.byteLength });
}
