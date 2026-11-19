// Add FAQPage JSON-LD to columbus-ltl-shipping.html from the Q&A already written on the page.
// The answers are lifted verbatim from the page text - nothing new is asserted. Idempotent.
//   node tools/add-faq-schema.mjs --check | --apply
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'columbus-ltl-shipping.html');
const APPLY = process.argv.includes('--apply');

let html = fs.readFileSync(FILE, 'utf8');
if (html.includes('"@type": "FAQPage"')) { console.log('FAQPage already present'); process.exit(0); }

const strip = s => s.replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&ndash;/g, '-').replace(/&mdash;/g, '-')
  .replace(/&rsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

// Only the headings phrased as questions are FAQ entries; the three feature headings are not.
const qa = [];
for (const m of html.matchAll(/<h3[^>]*>([^<]*\?)<\/h3>([\s\S]{0,1400}?)(?=<h3|<\/section|<footer)/g)) {
  const question = strip(m[1]);
  const paras = [...m[2].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(p => strip(p[1])).filter(Boolean);
  const answer = paras.join(' ').trim();
  if (question && answer.length > 25) qa.push({ question, answer });
}

if (!qa.length) { console.error('no question headings with answer paragraphs found'); process.exit(1); }

const faq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: qa.map(x => ({
    '@type': 'Question',
    name: x.question,
    acceptedAnswer: { '@type': 'Answer', text: x.answer },
  })),
};

console.log(`${qa.length} Q&A pair(s):`);
for (const x of qa) console.log(`  Q: ${x.question}\n     A: ${x.answer.slice(0, 150)}${x.answer.length > 150 ? '...' : ''}`);

if (!APPLY) { console.log('\ncheck only, nothing written'); process.exit(0); }

const block = `  <script type="application/ld+json">\n${JSON.stringify(faq, null, 2).split('\n').map(l => '  ' + l).join('\n')}\n  </script>\n`;
html = html.replace('</head>', block + '</head>');
fs.writeFileSync(FILE, html, 'utf8');
JSON.parse([...fs.readFileSync(FILE, 'utf8').matchAll(/application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].pop()[1]);
console.log('\nAPPLIED and re-parsed OK');
