// The storage API. Each handler gets {request, env, params, user}.
import { json, readJson, update, readBody, validId, MAPS, EMPTY_MANIFEST } from './store.js';

// GET /api/state: everything a browser needs to open the planner — the list of current files and every shared map.
export async function getState({ env, user }) {
  const [manifest, ...maps] = await Promise.all([
    readJson(env, 'manifest.json', EMPTY_MANIFEST),
    ...MAPS.map((name) => readJson(env, `state/${name}.json`, {})),
  ]);
  return json({
    user,
    manifest: manifest.value,
    maps: Object.fromEntries(MAPS.map((name, i) => [name, maps[i].value])),
  });
}

// POST /api/state/<name> with {set: {key: value}, del: [key]}: change only the entries sent,
// on top of whatever is saved now, so two people editing different items don't overwrite each other.
export async function patchState({ request, env, params }) {
  const name = params.name;
  if (!MAPS.includes(name)) return json({ error: 'unknown', message: `No shared list called ${name}.` }, 404);
  let patch;
  try {
    patch = JSON.parse(new TextDecoder().decode(await readBody(request, 4 * 1024 * 1024)));
  } catch (e) {
    return json({ error: 'bad_request', message: e.message === 'too_large' ? 'Change is too large.' : 'Change could not be read.' }, 400);
  }
  const set = patch && typeof patch.set === 'object' && patch.set ? patch.set : {};
  const del = Array.isArray(patch && patch.del) ? patch.del : [];
  try {
    const map = await update(env, `state/${name}.json`, {}, (cur) => {
      for (const [k, v] of Object.entries(set)) cur[k] = v;
      for (const k of del) delete cur[String(k)];
      return cur;
    });
    return json({ map });
  } catch (e) {
    return json({ error: 'busy', message: e.message }, 409);
  }
}

// GET / PUT /api/files/<id>: the uploaded files themselves, stored gzipped exactly as the browser sent them.
const FILE_LIMIT = 60 * 1024 * 1024;

export async function getFile({ env, params }) {
  if (!validId(params.id)) return json({ error: 'bad_request' }, 400);
  const obj = await env.DATA.get(`files/${params.id}`);
  if (!obj) return json({ error: 'not_found', message: 'That file is no longer in shared storage.' }, 404);
  return new Response(obj.body, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=31536000, immutable' } });
}

export async function putFile({ request, env, params, user }) {
  if (!validId(params.id)) return json({ error: 'bad_request' }, 400);
  let body;
  try {
    body = await readBody(request, FILE_LIMIT);
  } catch {
    return json({ error: 'too_large', message: 'That file is too large for shared storage (60 MB limit after compression).' }, 413);
  }
  await env.DATA.put(`files/${params.id}`, body, {
    httpMetadata: { contentType: 'application/octet-stream' },
    customMetadata: { by: String(user || ''), at: new Date().toISOString() },
  });
  return json({ ok: true, bytes: body.byteLength });
}

// POST /api/manifest with one change to which files are current:
//   {setInventory: meta}      replace the item list
//   {setPurchases: meta}      replace the distributor file (Item Purchase By Vendor)
//   {clearPurchases: true}    remove the distributor file
//   {addSales: [meta, ...]}   add weekly sales files
//   {removeSales: [id, ...]}  remove some sales files
//   {clearSales: true}        remove every sales file
//   {clearAll: true}          remove the item list, the distributor file and every sales file
// Files that drop out of the list are deleted from storage after the list is saved.
function cleanMeta(m, user) {
  if (!m || !validId(m.id)) throw new Error('bad file entry');
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(+v) ? +v : null);
  return {
    id: m.id,
    kind: m.kind === 'inv' || m.kind === 'purch' ? m.kind : 'sales',
    type: m.type === 'parsed' ? 'parsed' : 'raw',
    fileName: String(m.fileName || 'file').slice(0, 240),
    headerIdx: num(m.headerIdx) ?? 0,
    map: m.map && typeof m.map === 'object' ? Object.fromEntries(Object.entries(m.map).slice(0, 40).map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 200)])) : {},
    from: num(m.from),
    to: num(m.to),
    by: user,
    at: new Date().toISOString(),
  };
}

export async function changeManifest({ request, env, user }) {
  let op;
  try {
    op = JSON.parse(new TextDecoder().decode(await readBody(request, 2 * 1024 * 1024)));
  } catch {
    return json({ error: 'bad_request', message: 'Change could not be read.' }, 400);
  }
  const removed = new Set();
  let manifest;
  try {
    const metas = {
      inv: op.setInventory ? cleanMeta(op.setInventory, user) : null,
      purch: op.setPurchases ? cleanMeta(op.setPurchases, user) : null,
      sales: Array.isArray(op.addSales) ? op.addSales.slice(0, 600).map((m) => cleanMeta(m, user)) : [],
    };
    manifest = await update(env, 'manifest.json', EMPTY_MANIFEST, (cur) => {
      removed.clear();
      cur.sales = Array.isArray(cur.sales) ? cur.sales : [];
      cur.purchases = cur.purchases || null;
      if (op.clearAll) {
        if (cur.inventory) removed.add(cur.inventory.id);
        if (cur.purchases) removed.add(cur.purchases.id);
        cur.sales.forEach((f) => removed.add(f.id));
        cur.inventory = null;
        cur.purchases = null;
        cur.sales = [];
      }
      if (op.clearPurchases && cur.purchases) {
        removed.add(cur.purchases.id);
        cur.purchases = null;
      }
      if (op.clearSales) {
        cur.sales.forEach((f) => removed.add(f.id));
        cur.sales = [];
      }
      if (Array.isArray(op.removeSales)) {
        const drop = new Set(op.removeSales.map(String));
        cur.sales = cur.sales.filter((f) => (drop.has(f.id) ? (removed.add(f.id), false) : true));
      }
      if (metas.inv) {
        if (cur.inventory && cur.inventory.id !== metas.inv.id) removed.add(cur.inventory.id);
        cur.inventory = metas.inv;
      }
      if (metas.purch) {
        if (cur.purchases && cur.purchases.id !== metas.purch.id) removed.add(cur.purchases.id);
        cur.purchases = metas.purch;
      }
      if (metas.sales.length) {
        const have = new Set(cur.sales.map((f) => f.id));
        cur.sales.push(...metas.sales.filter((f) => !have.has(f.id)));
      }
      return cur;
    });
  } catch (e) {
    return json({ error: 'bad_request', message: e.message }, 400);
  }
  if (removed.size) await env.DATA.delete([...removed].map((id) => `files/${id}`));
  return json({ manifest });
}
