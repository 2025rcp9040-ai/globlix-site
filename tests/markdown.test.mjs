import test from 'node:test';
import assert from 'node:assert/strict';
import { markdown } from '../scripts/lib/markdown.mjs';

test('headings, lists, tables, links', () => {
  const html = markdown(`## Markets\n\n- **USA** and [UK](https://example.com)\n- EU\n\n| A | B |\n|---|---:|\n| 1 | 2 |\n\n1. one\n2. two`);
  assert.match(html, /<h2 id="markets">Markets<\/h2>/);
  assert.match(html, /<li><strong>USA<\/strong> and <a href="https:\/\/example.com" target="_blank" rel="noopener">UK<\/a><\/li>/);
  assert.match(html, /<th style="text-align:right">B<\/th>/);
  assert.match(html, /<ol><li>one<\/li><li>two<\/li><\/ol>/);
});

test('escapes raw HTML and unsafe links', () => {
  const html = markdown(`<script>alert(1)</script> [x](javascript:alert(1))`);
  assert.ok(!html.includes('<script>'));
  assert.match(html, /href="#"/);
});

test('h1 in content is demoted (page title is the only h1)', () => {
  assert.match(markdown('# Big'), /^<h2/);
});

test('chart, stats and steps blocks render accessible HTML', () => {
  const html = markdown('```chart\ntitle: Imports\nunit: USD bn\nhighlight: India\nUSA | 3.42\nIndia | 1,170\n```\n\n```stats\n38% | share | UN\n```\n\n```steps\nShip | book freight\n```');
  assert.match(html, /class="bar-row is-hl" title="India: 1,170 USD bn"/);
  assert.match(html, /--r:1\.0000/); // 1,170 is the max once commas are read
  assert.match(html, /<table class="sr-only">/);
  assert.match(html, /class="stat-value">38%</);
  assert.match(html, /<ol class="viz-steps"><li><p class="step-title">Ship<\/p>/);
});
