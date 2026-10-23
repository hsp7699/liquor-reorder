// Every /api request must come through Cloudflare Access. Access signs each request with a JWT;
// we check that signature against the team's public keys, so the storage can't be reached around it.
// If Access isn't configured yet (ACCESS_TEAM_DOMAIN / ACCESS_AUD unset), the API stays closed.
import { json } from './store.js';

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

// Returns the signed-in email, or a Response explaining why the request is refused.
export async function authenticate(request, env) {
  // accepts the team domain ("yourteam.cloudflareaccess.com") or the full key address Cloudflare shows
  const team = (env.ACCESS_TEAM_DOMAIN || '').trim().replace(/\/cdn-cgi\/access\/certs\/?$/, '');
  const aud = (env.ACCESS_AUD || '').trim();
  if (!team || !aud) return json({ error: 'not_configured', message: 'Cloudflare Access isn’t set up for this site yet, so shared storage is off.' }, 503);
  if (!env.DATA) return json({ error: 'no_storage', message: 'The R2 bucket isn’t connected to this site yet.' }, 503);
  const teamUrl = (/^https?:\/\//.test(team) ? team : `https://${team}`).replace(/\/+$/, '');
  const token = request.headers.get('cf-access-jwt-assertion') || cookie(request, 'CF_Authorization');
  if (!token) return json({ error: 'unauthorized', message: 'Not signed in through Cloudflare Access.' }, 401);
  try {
    return { user: await verifyAccessJwt(token, teamUrl, aud) };
  } catch (e) {
    return json({ error: 'unauthorized', message: `Sign-in check failed: ${e.message}. Reload the page to sign in again.` }, 401);
  }
}
