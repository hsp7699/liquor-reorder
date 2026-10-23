// Builds the Cloudflare site (public/index.html) from app.html, the planner's single source file.
// app.html is written as page content (it is also published as-is on claude.ai), so here it gets a
// full HTML document around it. Run: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const cut = src.indexOf('<style>');
const head = src.slice(0, cut).replace(/<meta name="claude:[^>]*>\s*/g, '').trim();
const body = src.slice(cut);
const reset = ":root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,'Segoe UI',sans-serif}img{max-width:100%}[hidden]{display:none!important}";
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="lrp-storage" content="cloudflare">
${head}
<style>${reset}</style>
</head>
<body>
${body}
</body>
</html>
`;
mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/index.html', import.meta.url), page);
writeFileSync(new URL('../public/_headers', import.meta.url), '/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n');
console.log(`public/index.html written (${Math.round(page.length / 1024)} KB)`);
