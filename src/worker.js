// The Cloudflare Worker: serves the planner page from public/ and the storage API under /api.
import { json } from './store.js';
import { authenticate } from './auth.js';
import { getState, patchState, getFile, putFile, changeManifest } from './api.js';

const ROUTES = [
  ['GET', /^\/api\/state$/, getState, []],
  ['POST', /^\/api\/state\/([a-z]+)$/, patchState, ['name']],
  ['POST', /^\/api\/manifest$/, changeManifest, []],
  ['GET', /^\/api\/files\/([^/]+)$/, getFile, ['id']],
  ['PUT', /^\/api\/files\/([^/]+)$/, putFile, ['id']],
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const auth = await authenticate(request, env);
    if (auth instanceof Response) return auth;
    for (const [method, re, handler, names] of ROUTES) {
      const m = url.pathname.match(re);
      if (!m) continue;
      if (request.method !== method) continue;
      const params = Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      return handler({ request, env, params, user: auth.user });
    }
    return json({ error: 'not_found', message: 'No such storage address.' }, 404);
  },
};
