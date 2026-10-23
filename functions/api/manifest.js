// POST /api/manifest with one change: which files are current.
//   {setInventory: meta}      replace the item list
//   {addSales: [meta, ...]}   add weekly sales files
//   {removeSales: [id, ...]}  remove some sales files
//   {clearSales: true}        remove every sales file
//   {clearAll: true}          remove the item list and every sales file
// Files that drop out of the list are deleted from storage after the list is saved.
import { json, update, readBody, validId, EMPTY_MANIFEST } from '../../lib/store.js';

function cleanMeta(m, user) {
  if (!m || !validId(m.id)) throw new Error('bad file entry');
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(+v) ? +v : null);
  return {
    id: m.id,
    kind: m.kind === 'inv' ? 'inv' : 'sales',
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

export async function onRequestPost({ request, env, data }) {
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
      inv: op.setInventory ? cleanMeta(op.setInventory, data.user) : null,
      sales: Array.isArray(op.addSales) ? op.addSales.slice(0, 600).map((m) => cleanMeta(m, data.user)) : [],
    };
    manifest = await update(env, 'manifest.json', EMPTY_MANIFEST, (cur) => {
      removed.clear();
      cur.sales = Array.isArray(cur.sales) ? cur.sales : [];
      if (op.clearAll) {
        if (cur.inventory) removed.add(cur.inventory.id);
        cur.sales.forEach((f) => removed.add(f.id));
        cur.inventory = null;
        cur.sales = [];
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
