# Liquor Reorder Planner

A reorder planner for a liquor store running Advent POS. Load the **Item List Report** and weekly
**Item Sales Report** exports, and it forecasts what each item will sell over the next 30/60/90 days,
suggests order quantities per distributor, and helps work out quantity deals (QDs).

On the Cloudflare site, uploaded files, the order, QDs, saved deals and settings are kept in your own
Cloudflare R2 storage behind Cloudflare Access, so every computer you sign in on sees the same data.

## What's in here

| Path | What it is |
|---|---|
| `app.html` | The whole planner: one page, no server needed. Edit this file. |
| `public/index.html` | The Cloudflare site, built from `app.html` (don't edit by hand) |
| `functions/api/` | The storage API Cloudflare runs next to the site |
| `lib/store.js` | Shared code for the API (R2 reads and writes) |
| `wrangler.toml` | Cloudflare settings: the R2 bucket and the Access settings |
| `scripts/build.mjs` | Builds `public/index.html` from `app.html` |

After changing `app.html`, run `node scripts/build.mjs` and commit both files.

## One-time Cloudflare setup

1. **R2 bucket.** In the Cloudflare dashboard open **R2 Object Storage**, click **Create bucket** and name
   it exactly `liquor-reorder-data`. (The first time, Cloudflare asks for a payment card even for the
   free tier. This planner uses a few dozen MB, well inside the free 10 GB.)
2. **Pages project.** Open **Workers & Pages → Create → Pages → Connect to Git**, pick this repository,
   leave the build command empty and deploy. Settings come from `wrangler.toml`. You get an address
   like `liquor-reorder.pages.dev`.
3. **Cloudflare Access.** In **Zero Trust → Access → Applications → Add an application → Self-hosted**,
   protect `liquor-reorder.pages.dev` (and `*.liquor-reorder.pages.dev` for preview builds) with a policy
   that allows only your email addresses.
4. **Tell the API about Access.** Put your team domain (from **Zero Trust → Settings → Custom pages**,
   like `yourteam.cloudflareaccess.com`) and the application's **Application Audience (AUD) Tag** into
   `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in `wrangler.toml`, commit and push. Neither is a secret.

Until step 4 is done, the storage API refuses every request and the planner keeps data in each
browser, so nothing is ever exposed by a half-finished setup.

## How the shared storage works

- Every `/api` request must carry a valid Cloudflare Access sign-in. The API checks the token's
  signature against your team's public keys, its audience tag and its expiry
  (`functions/api/_middleware.js`).
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
npx wrangler pages dev --binding ACCESS_TEAM_DOMAIN=<team url> --binding ACCESS_AUD=<aud>
```
