// Every /api request must be signed in. Two ways, either is enough:
//   1. Store password (APP_PASSWORD, a Cloudflare secret): the browser signs in once at /api/login and
//      gets a session cookie signed with a key derived from the password, good for 90 days. Changing the
//      password signs every browser out.
//   2. Cloudflare Access (ACCESS_TEAM_DOMAIN + ACCESS_AUD): Access signs each request with a JWT and we
//      check that signature against the team's public keys.
// If neither is configured, the API stays closed.
import { json } from './store.js';

const SESSION_DAYS = 90;
const MIN_PASSWORD = 8;
const LOCK_AFTER = 10; // wrong passwords from one address…
const LOCK_MINUTES = 15; // …within this window lock that address out for the rest of it

let certs = { url: '', keys: [], at: 0 };

async function accessKeys(certsUrl, fresh) {
  if (!fresh && certs.url === certsUrl && Date.now() - certs.at < 60 * 60 * 1000) return certs.keys;
  const res = await fetch(certsUrl);
  if (!res.ok) throw new Error('could not load Access keys');
  const body = await res.json();
  certs = { url: certsUrl, keys: body.keys || [], at: Date.now() };
  return certs.keys;
}

const b64urlBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function verifyAccessJwt(token, teamUrl, aud) {
  const [h, p, sig] = token.split('.');
  if (!h || !p || !sig) throw new Error('malformed token');
  const header = b64urlJson(h);
  const payload = b64urlJson(p);
  if (header.alg !== 'RS256') throw new Error('unexpected algorithm');
  const certsUrl = `${teamUrl}/cdn-cgi/access/certs`;
  let jwk = (await accessKeys(certsUrl, false)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await accessKeys(certsUrl, true)).find((k) => k.kid === header.kid); // keys rotate
  if (!jwk) throw new Error('unknown signing key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('bad signature');
  const now = Math.floor(Date.now() / 1000);
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new Error('token is for a different application');
  if (payload.exp && payload.exp < now) throw new Error('sign-in expired');
  if (payload.nbf && payload.nbf > now + 60) throw new Error('token not valid yet');
  if (payload.iss && payload.iss.replace(/\/+$/, '') !== teamUrl) throw new Error('token from a different team');
  return payload.email || payload.sub || 'unknown';
}

function cookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
}

/* ---------- store password ---------- */
const password = (env) => (env.APP_PASSWORD || '').trim();

// the session signing key comes from the password, so a new password invalidates every old session
async function sessionKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('lrp-session-v1:' + password(env)));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function makeSession(env) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const sig = await crypto.subtle.sign('HMAC', await sessionKey(env), new TextEncoder().encode(String(exp)));
  return `${exp}.${b64url(sig)}`;
}

async function checkSession(env, value) {
  const [exp, sig] = String(value || '').split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || +exp < Date.now() / 1000) return false;
  try {
    return await crypto.subtle.verify('HMAC', await sessionKey(env), b64urlBytes(sig), new TextEncoder().encode(exp));
  } catch {
    return false;
  }
}

// compares without leaking where the first difference is
async function samePassword(a, b) {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}

const sessionCookie = (value, maxAge) => `lrp_session=${value}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

// wrong guesses are counted per address in R2, so a password can't be guessed at speed
const failKey = (request) => `auth/fails-${(request.headers.get('cf-connecting-ip') || 'unknown').replace(/[^0-9a-fA-F:.]/g, '')}.json`;
async function recentFails(env, request) {
  const obj = await env.DATA.get(failKey(request));
  if (!obj) return [];
  const since = Date.now() - LOCK_MINUTES * 60 * 1000;
  return ((await obj.json()).at || []).filter((t) => t > since);
}

// POST /api/login with {password}
export async function login(request, env) {
  if (password(env).length < MIN_PASSWORD) return json({ error: 'not_configured', message: 'No store password is set for this site yet.' }, 503);
  if (!env.DATA) return json({ error: 'no_storage', message: 'The R2 bucket isn’t connected to this site yet.' }, 503);
  const fails = await recentFails(env, request);
  if (fails.length >= LOCK_AFTER) return json({ error: 'locked', message: `Too many wrong passwords. Try again in ${LOCK_MINUTES} minutes.` }, 429);
  let given = '';
  try {
    given = String((await request.json()).password || '');
  } catch {}
  if (!given || !(await samePassword(given, password(env)))) {
    await env.DATA.put(failKey(request), JSON.stringify({ at: [...fails, Date.now()] }));
    await new Promise((r) => setTimeout(r, 400));
    return json({ error: 'wrong_password', message: 'That password isn’t right.' }, 401);
  }
  if (fails.length) await env.DATA.delete(failKey(request));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': sessionCookie(await makeSession(env), SESSION_DAYS * 86400) },
  });
}

// POST /api/logout
export function logout() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': sessionCookie('', 0) },
  });
}

// Changes must come from the planner's own page, not another site using a signed-in browser.
export function sameOrigin(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return true;
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

// Returns the signed-in user, or a Response explaining why the request is refused.
export async function authenticate(request, env) {
  // accepts the team domain ("yourteam.cloudflareaccess.com") or the full key address Cloudflare shows
  const team = (env.ACCESS_TEAM_DOMAIN || '').trim().replace(/\/cdn-cgi\/access\/certs\/?$/, '');
  const aud = (env.ACCESS_AUD || '').trim();
  const usePassword = password(env).length >= MIN_PASSWORD;
  const useAccess = !!(team && aud);
  if (!usePassword && !useAccess) {
    const short = password(env) ? ` (the store password must be at least ${MIN_PASSWORD} characters)` : '';
    return json({ error: 'not_configured', message: `Shared storage needs a store password or Cloudflare Access, and neither is set up yet${short}.` }, 503);
  }
  if (!env.DATA) return json({ error: 'no_storage', message: 'The R2 bucket isn’t connected to this site yet.' }, 503);
  if (usePassword && (await checkSession(env, cookie(request, 'lrp_session')))) return { user: 'store' };
  const token = useAccess && (request.headers.get('cf-access-jwt-assertion') || cookie(request, 'CF_Authorization'));
  if (token) {
    const teamUrl = (/^https?:\/\//.test(team) ? team : `https://${team}`).replace(/\/+$/, '');
    try {
      return { user: await verifyAccessJwt(token, teamUrl, aud) };
    } catch (e) {
      if (!usePassword) return json({ error: 'unauthorized', message: `Sign-in check failed: ${e.message}. Reload the page to sign in again.` }, 401);
    }
  }
  if (usePassword) return json({ error: 'login_required', message: 'Enter the store password to open the shared files.' }, 401);
  return json({ error: 'unauthorized', message: 'Not signed in through Cloudflare Access.' }, 401);
}
