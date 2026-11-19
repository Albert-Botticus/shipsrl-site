// One-off: the free LLM/search discoverability fixes from research/llm-visibility/FINDINGS.md
// (Nathan authorised 2026-11-19). Idempotent - safe to re-run; it skips anything already applied.
//
//   node tools/seo-fix.mjs --check    report what would change
//   node tools/seo-fix.mjs --apply    write the files
//
// Why each change: an assistant answering "freight broker in Columbus Ohio" needs a location to
// match, and the site published none. Street address is deliberately NOT added: it is Nathan's
// home, and city+state+ZIP carries essentially all of the retrieval value.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const SITE = 'https://shipsrl.com';

const CITY = 'Westerville';
const REGION = 'OH';
const ZIP = '43081';
const HOURS_TEXT = 'Monday&ndash;Friday, 8am&ndash;6pm Eastern';

const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const changes = [];
const note = (file, what) => changes.push(`${file.padEnd(46)} ${what}`);

// ---- 1. Footer: a real location and hours, in text, on every page --------------------------
const FOOTER_BLOCK = `        <li>Serving ${CITY} &amp; Columbus, Ohio and shippers across North America</li>
        <li>${CITY}, ${REGION} ${ZIP}</li>
        <li>${HOURS_TEXT}</li>
`;

// ---- 2. Head additions ---------------------------------------------------------------------
const canonicalFor = f => `  <link rel="canonical" href="${SITE}/${f === 'index.html' ? '' : f}">\n`;

// ---- 3. JSON-LD for the two pages that have none -------------------------------------------
const localBusinessNode = {
  '@type': 'LocalBusiness',
  '@id': `${SITE}/#business`,
  name: 'SRL Logistics, an Armstrong Transport Group Agency',
  url: `${SITE}/`,
  telephone: '+1-614-855-9504',
  email: 'SRLteam@armstrongtransport.com',
  address: { '@type': 'PostalAddress', addressLocality: CITY, addressRegion: REGION, postalCode: ZIP, addressCountry: 'US' },
};

const LD_LTL_QUOTE = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'LTL freight quotes',
  serviceType: 'Less-than-truckload freight brokerage',
  description: 'Pallet and partial-load LTL freight quotes for shippers in Westerville, Columbus and across Ohio, priced through Armstrong Transport Group’s LTL carrier network.',
  provider: localBusinessNode,
  areaServed: [{ '@type': 'Country', name: 'United States' }, { '@type': 'Country', name: 'Canada' }, { '@type': 'Country', name: 'Mexico' }],
  url: `${SITE}/ltl-quote.html`,
};

const LD_CARRIERS = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Carrier setup and requirements',
  description: 'Carrier onboarding, insurance and authority requirements for hauling freight tendered by SRL Logistics, an Armstrong Transport Group agency.',
  url: `${SITE}/carriers.html`,
  about: localBusinessNode,
};

const ldScript = obj => `  <script type="application/ld+json">\n${JSON.stringify(obj, null, 2).split('\n').map(l => '  ' + l).join('\n')}\n  </script>\n`;

for (const f of pages) {
  const file = path.join(ROOT, f);
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // Footer location + hours. Anchored to the <ul> under the footer's own "Contact" heading -
  // NOT to the first mailto on the page, which is in the contact section higher up and put the
  // block in the nav list on the first attempt.
  if (!html.includes(`${CITY}, ${REGION} ${ZIP}`)) {
    const fStart = html.lastIndexOf('<footer');
    const cStart = fStart < 0 ? -1 : html.indexOf('<h4>Contact</h4>', fStart);
    const ulEnd = cStart < 0 ? -1 : html.indexOf('</ul>', cStart);
    if (ulEnd > 0) {
      html = html.slice(0, ulEnd) + FOOTER_BLOCK + '      ' + html.slice(ulEnd);
      note(f, 'footer: added city/ZIP, service area and hours');
    } else note(f, '!! SKIPPED footer (no Contact list inside <footer>)');
  }

  // Canonical.
  if (!/rel="canonical"/.test(html)) {
    html = html.replace('</head>', canonicalFor(f) + '</head>');
    note(f, 'added canonical');
  }

  // Open Graph. Each tag added only if absent, so pages that already have some (index) do not
  // end up with duplicates.
  if (html.includes('content="img/srl-cover.png"')) {
    html = html.replace(/content="img\/srl-cover\.png"/g, `content="${SITE}/img/srl-cover.png"`);
    note(f, 'og:image made absolute');
  }
  const ogAdd = [];
  if (!/property="og:url"/.test(html)) ogAdd.push(`  <meta property="og:url" content="${SITE}/${f === 'index.html' ? '' : f}">`);
  if (!/property="og:type"/.test(html)) ogAdd.push('  <meta property="og:type" content="website">');
  if (!/property="og:image"/.test(html)) ogAdd.push(`  <meta property="og:image" content="${SITE}/img/srl-cover.png">`);
  if (ogAdd.length) {
    html = html.replace('</head>', ogAdd.join('\n') + '\n</head>');
    note(f, `added ${ogAdd.length} og tag(s)`);
  }

  // JSON-LD where there is none.
  if (!/application\/ld\+json/.test(html)) {
    const obj = f === 'ltl-quote.html' ? LD_LTL_QUOTE : f === 'carriers.html' ? LD_CARRIERS : null;
    if (obj) {
      html = html.replace('</head>', ldScript(obj) + '</head>');
      note(f, 'added JSON-LD');
    }
  }

  if (html !== before && APPLY) fs.writeFileSync(file, html, 'utf8');
}

console.log(changes.length ? changes.join('\n') : 'nothing to change');
console.log(`\n${APPLY ? 'APPLIED' : 'check only, nothing written'} - ${changes.length} change(s) across ${pages.length} pages`);
