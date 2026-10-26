# Liquor Reorder Planner

A reorder planner for a liquor store running Advent POS. Load the **Item List Report** and weekly
**Item Sales Report** exports, and it forecasts what each item will sell over the next 30/60/90 days,
suggests order quantities per distributor, and helps work out quantity deals (QDs).

On the Cloudflare site (a Cloudflare Worker), uploaded files, the order, QDs, saved deals and settings are kept in your own
Cloudflare R2 storage behind a store password, so every computer you sign in on sees the same data.

## What's in here

| Path | What it is |
|---|---|
| `app.html` | The whole planner: one page, no server needed. Edit this file. |
| `public/index.html` | The page the Cloudflare Worker serves, built from `app.html` (don't edit by hand) |
| `src/worker.js` | The Cloudflare Worker: serves the page and routes `/api` to the storage API |
| `src/api.js`, `src/store.js` | The storage API (R2 reads and writes) |
| `src/auth.js` | Checks the sign-in (store password session, or Cloudflare Access) on every `/api` request |
| `wrangler.toml` | Cloudflare settings: the Worker and the R2 bucket |
| `scripts/build.mjs` | Builds `public/index.html` from `app.html` |

After changing `app.html`, run `node scripts/build.mjs` and commit both files.

## One-time Cloudflare setup

1. **R2 bucket.** In the Cloudflare dashboard open **R2 Object Storage**, click **Create bucket** and name
   it exactly `liquor-reorder-data`. (The first time, Cloudflare asks for a payment card even for the
   free tier. This planner uses a few dozen MB, well inside the free 10 GB.) The Worker won't deploy
   until the bucket exists.
2. **Worker.** **Workers & Pages → Create → Import a repository**, pick this repository and deploy with
   the default deploy command (`npx wrangler deploy`). The Worker's name must be `liquor-reorder`, the
   `name` in `wrangler.toml`. You get an address like `liquor-reorder.<your-account>.workers.dev`.
3. **Store password.** Open the Worker → **Settings → Variables and Secrets → Add**, choose type
   **Secret**, name it `APP_PASSWORD` and enter a password of at least 8 characters (longer is better).
   Click **Deploy**. Use the Secret type: a plain Text variable would be wiped by the next deploy.

Until a password is set, the storage API refuses every request and the site shows only a setup
screen, so nothing is ever exposed by a half-finished setup. The Cloudflare site never keeps data in
the browser: it works only from shared storage, and shows only the password screen until you sign in.

Cloudflare Access still works instead of (or as well as) the password: fill in `ACCESS_TEAM_DOMAIN` and
`ACCESS_AUD` in `wrangler.toml`.

## How the shared storage works

- Every `/api` request must be signed in (`src/auth.js`). Each browser asks for the store password
  once and gets a session cookie (HttpOnly, Secure, SameSite=Strict) signed with a key derived from
  the password, good for 90 days. Changing the password signs every browser out. Ten wrong passwords
  from one address lock it out for 15 minutes, and changes are only accepted from the planner's own
  page. With Cloudflare Access configured, a valid Access token is accepted too.
- Uploaded files are stored gzipped, exactly as exported, in `files/<id>`; `manifest.json` lists which
  ones are current. Each browser re-reads the original files, so improvements to the CSV reader apply
  to old uploads too.
- The order, QDs, saved deals and settings are stored as maps in `state/<name>.json`. A browser sends
  only the entries it changed and the server applies them on top of the latest saved version (with an
  R2 conditional write), so two people adding different items at the same time both keep their change.
- Browsers check for changes every 30 seconds and whenever you switch back to the tab.
- The same `app.html` published anywhere else (for example on claude.ai) has no storage API and keeps
  everything in that browser.

## Running it locally

```sh
node scripts/build.mjs
npx wrangler dev --var APP_PASSWORD:<a test password>
```
