// Tell Bing (and the other IndexNow participants) that these pages exist or changed.
//
//   node tools/indexnow.mjs            submit every URL in sitemap.xml
//   node tools/indexnow.mjs <url>...   submit specific URLs
//
// IndexNow needs no account: the key is proved by hosting <key>.txt at the site root, which is
// committed next to the pages. Run it after a push, once GitHub Pages has the new files live.
// Why this exists: as of 2026-11-19 only 3 of 13 pages were in Bing's index, and Bing is what
// Copilot reads and what ChatGPT's search leans on.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'shipsrl.com';

const keyFile = fs.readdirSync(ROOT).find(f => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) { console.error('no IndexNow key file at the site root'); process.exit(1); }
const key = keyFile.replace('.txt', '');

let urls = process.argv.slice(2).filter(a => a.startsWith('http'));
if (!urls.length) {
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}
if (!urls.length) { console.error('no URLs to submit'); process.exit(1); }

// Verify the key file is actually reachable before submitting; IndexNow rejects the batch
// otherwise and the error it returns is not obvious.
const probe = await fetch(`https://${HOST}/${keyFile}`).catch(() => null);
const probeText = probe && probe.ok ? (await probe.text()).trim() : '';
if (probeText !== key) {
  console.error(`key file not live yet at https://${HOST}/${keyFile} (got ${probe ? probe.status : 'no response'}).`);
  console.error('Push first, wait for GitHub Pages to publish, then re-run.');
  process.exit(2);
}
console.log(`key verified live: https://${HOST}/${keyFile}`);

const res = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList: urls }),
});
const body = await res.text();
console.log(`IndexNow -> HTTP ${res.status} ${res.statusText}`);
console.log(`submitted ${urls.length} url(s)`);
if (body.trim()) console.log(body.slice(0, 400));
// 200 accepted, 202 accepted pending key validation; both are fine.
process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
