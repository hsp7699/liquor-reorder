// Shared helpers for the storage API. Everything lives in one R2 bucket (binding DATA):
//   manifest.json          which uploaded files are current (item list + weekly sales)
//   files/<id>             each uploaded file, gzipped
//   state/<name>.json      shared maps: the order, QDs, saved deals, settings, adjustments

export const MAPS = ['settings', 'vendors', 'overrides', 'depts', 'deals', 'qdorders', 'cart'];
export const EMPTY_MANIFEST = { inventory: null, sales: [] };

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(id);

export async function readJson(env, key, fallback) {
  const obj = await env.DATA.get(key);
  if (!obj) return { value: structuredClone(fallback), etag: null };
  return { value: await obj.json(), etag: obj.etag };
}

// Read, change and write back. If someone else saved in between, R2 rejects the write
// (etag no longer matches) and we start again from their version, so no change is lost.
export async function update(env, key, fallback, change) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { value, etag } = await readJson(env, key, fallback);
    const next = change(value);
    const opts = { httpMetadata: { contentType: 'application/json' } };
    if (etag) opts.onlyIf = { etagMatches: etag };
    const saved = await env.DATA.put(key, JSON.stringify(next), opts);
    if (saved) return next;
    await new Promise((r) => setTimeout(r, 25 + Math.random() * 150));
  }
  throw new Error('Too many people saving at once. Try again.');
}

export async function readBody(request, limitBytes) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > limitBytes) throw new Error('too_large');
  const buf = await request.arrayBuffer();
  if (buf.byteLength > limitBytes) throw new Error('too_large');
  return buf;
}
