// GET /api/state: everything a browser needs to open the planner — the list of current files and every shared map.
import { json, readJson, MAPS, EMPTY_MANIFEST } from '../../lib/store.js';

export async function onRequestGet({ env, data }) {
  const [manifest, ...maps] = await Promise.all([
    readJson(env, 'manifest.json', EMPTY_MANIFEST),
    ...MAPS.map((name) => readJson(env, `state/${name}.json`, {})),
  ]);
  return json({
    user: data.user,
    manifest: manifest.value,
    maps: Object.fromEntries(MAPS.map((name, i) => [name, maps[i].value])),
  });
}
