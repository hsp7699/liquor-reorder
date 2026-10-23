# Liquor Reorder Planner

A reorder planner for a liquor store running Advent POS. Load the **Item List Report** and weekly
**Item Sales Report** exports, and it forecasts what each item will sell over the next 30/60/90 days,
suggests order quantities per distributor, and helps work out quantity deals (QDs).

On the Cloudflare site (a Cloudflare Worker), uploaded files, the order, QDs, saved deals and settings are kept in your own
Cloudflare R2 storage behind Cloudflare Access, so every computer you sign in on sees the same data.

## What's in here

| Path | What it is |
|---|---|
| `app.html` | The whole planner: one page, no server needed. Edit this file. |
| `public/index.html` | The page the Cloudflare Worker serves, built from `app.html` (don't edit by hand) |
| `src/worker.js` | The Cloudflare Worker: serves the page and routes `/api` to the storage API |
| `src/api.js`, `src/store.js` | The storage API (R2 reads and writes) |
| `src/auth.js` | Checks the Cloudflare Access sign-in on every `/api` request |
| `wrangler.toml` | Cloudflare settings: the Worker, the R2 bucket and the Access settings |
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
3. **Cloudflare Access.** Open the Worker → **Settings → Domains & Routes**, and next to **workers.dev**
   click **Enable Cloudflare Access**. Then click **Manage Cloudflare Access** and set the email addresses
   allowed in. Cloudflare shows the application's **audience (AUD) tag** and **JWKS URL**.
4. **Tell the API about Access.** Put the JWKS URL (or just the team domain,
   `yourteam.cloudflareaccess.com`) into `ACCESS_TEAM_DOMAIN` and the AUD tag into `ACCESS_AUD` in
   `wrangler.toml`, commit and push. Neither is a secret.

Until step 4 is done, the storage API refuses every request and the planner keeps data in each
browser, so nothing is ever exposed by a half-finished setup.

## How the shared storage works

- Every `/api` request must carry a valid Cloudflare Access sign-in. The API checks the token's
  signature against your team's public keys, its audience tag and its expiry
  (`src/auth.js`).
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
npx wrangler dev --var ACCESS_TEAM_DOMAIN:<team domain> --var ACCESS_AUD:<aud tag>
```
