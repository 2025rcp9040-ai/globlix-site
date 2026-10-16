import test from 'node:test';
import assert from 'node:assert/strict';
import { splitFrontmatter, parseYaml } from '../scripts/lib/yaml.mjs';

test('reads Decap-style front matter', () => {
  const src = `---\ntitle: "Rugs: where to grow"\ndate: 2026-10-14\ndescription: >-\n  India leads the world\n  in hand-knotted rugs.\ntags:\n  - Carpets\n  - HSN 57\ndraft: false\norder: 2\n---\nBody text\n`;
  const { data, body } = splitFrontmatter(src);
  assert.equal(data.title, 'Rugs: where to grow');
  assert.equal(data.date, '2026-10-14');
  assert.equal(data.description, 'India leads the world in hand-knotted rugs.');
  assert.deepEqual(data.tags, ['Carpets', 'HSN 57']);
  assert.equal(data.draft, false);
  assert.equal(data.order, 2);
  assert.equal(body.trim(), 'Body text');
});

test('plain multi-line scalars, single quotes, flow lists, literal blocks', () => {
  const d = parseYaml(`a: one two\n  three four\nb: 'it''s fine'\nc: [x, "y z", 3]\nd: |\n  line 1\n  line 2\ne: 07\nf: Hindi शीर्षक`);
  assert.equal(d.a, 'one two three four');
  assert.equal(d.b, "it's fine");
  assert.deepEqual(d.c, ['x', 'y z', 3]);
  assert.equal(d.d, 'line 1\nline 2\n');
  assert.equal(d.e, '07');
  assert.equal(d.f, 'Hindi शीर्षक');
});

test('lists of maps and lists at the parent indent', () => {
  const d = parseYaml(`items:\n- title: A\n  text: first\n- title: B\n  text: second\nafter: yes`);
  assert.deepEqual(d.items, [{ title: 'A', text: 'first' }, { title: 'B', text: 'second' }]);
  assert.equal(d.after, 'yes');
});
