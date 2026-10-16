import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.test-dist');
execFileSync('node', ['scripts/build.mjs'], { cwd: root, env: { ...process.env, OUT_DIR: '.test-dist' } });
const page = (p) => fs.readFileSync(path.join(out, p), 'utf8');
const fieldNames = (html, form) => {
  const m = html.match(new RegExp(`<form[^>]*name="${form}"[\\s\\S]*?</form>`));
  return [...new Set([...m[0].matchAll(/name="([^"]+)"/g)].map((x) => x[1]))].sort();
};

test('every expected page exists in both languages', () => {
  for (const p of ['index.html', 'services/index.html', 'services/setup-compliance/index.html', 'markets/index.html', 'schemes/index.html', 'insights/index.html', 'contact/index.html', 'free-hsn-snapshot/index.html', 'thank-you/index.html', '404.html', 'privacy/index.html']) {
    assert.ok(fs.existsSync(path.join(out, p)), p);
    assert.ok(fs.existsSync(path.join(out, 'hi', p)), 'hi/' + p);
  }
});

test('forms post to /api/lead and are identical across languages', () => {
  for (const [p, form] of [['contact/index.html', 'contact'], ['free-hsn-snapshot/index.html', 'hsn-snapshot']]) {
    const en = page(p), hi = page('hi/' + p);
    assert.match(en, new RegExp(`name="${form}"[^>]*action="/api/lead"`));
    assert.match(hi, /data-thanks="\/hi\/thank-you\/"/);
    assert.ok(!en.includes('data-netlify'));
    assert.ok(fs.existsSync(path.join(out, '_headers')));
    assert.deepEqual(fieldNames(en, form), fieldNames(hi, form));
  }
});

test('hreflang, canonical, lang attribute and sitemap', () => {
  const hi = page('hi/index.html');
  assert.match(hi, /<html lang="hi-IN">/);
  assert.match(hi, /hreflang="en" href="https:\/\/globlix.in\/"/);
  assert.match(hi, /rel="canonical" href="https:\/\/globlix.in\/hi\/"/);
  const sm = page('sitemap.xml');
  assert.match(sm, /<loc>https:\/\/globlix.in\/hi\/insights\/rugs-and-carpets-export-markets\/<\/loc>/);
  assert.ok(!sm.includes('thank-you'));
  assert.match(page('thank-you/index.html'), /noindex/);
});

test.after(() => fs.rmSync(out, { recursive: true, force: true }));

test('home quick enquiry form is identical across languages', () => {
  const en = page('index.html'), hi = page('hi/index.html');
  assert.match(en, /name="quick-enquiry"[^>]*action="\/api\/lead"/);
  assert.ok(!en.includes('cf-turnstile'), 'Turnstile stays off until a site key is set');
  assert.deepEqual(fieldNames(en, 'quick-enquiry'), fieldNames(hi, 'quick-enquiry'));
  assert.match(en, /"@type":"FAQPage"/);
});

test('SEO and AI-readiness: schema, breadcrumbs, llms.txt, async fonts', () => {
  const home = page('index.html');
  assert.match(home, /"@type":"ProfessionalService"/);
  assert.match(home, /"alternateName":"Globlix Exim Solutions"/);
  assert.match(home, /"@type":"OfferCatalog"/);
  assert.match(home, /rel="preload" as="style"/);
  assert.ok(!home.includes('Noto+Sans+Devanagari'), 'English pages skip the Hindi font');
  assert.match(page('hi/index.html'), /Noto\+Sans\+Devanagari/);
  const svc = page('services/setup-compliance/index.html');
  assert.match(svc, /"@type":"Service"/);
  assert.match(svc, /"@type":"BreadcrumbList"/);
  assert.match(svc, /class="crumbs"/);
  const post = page('insights/rugs-and-carpets-export-markets/index.html');
  assert.match(post, /"dateModified":"2026-10-15/);
  const llms = page('llms.txt');
  assert.match(llms, /^# Globlix/);
  assert.match(llms, /Setup & Compliance/);
  assert.match(llms, /Free HSN export snapshot/);
});
