// POST /api/state/<name> with {set: {key: value}, del: [key]}: change only the entries sent,
// on top of whatever is saved now, so two people editing different items don't overwrite each other.
import { json, update, readBody, MAPS } from '../../../lib/store.js';

export async function onRequestPost({ request, env, params }) {
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
