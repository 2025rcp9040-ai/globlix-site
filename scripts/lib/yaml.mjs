// Minimal YAML front-matter reader for the content files Decap CMS writes.
// Supports: key: value, quoted strings (single/double, multi-line), plain
// multi-line scalars, block scalars (| and >, with - or + chomping),
// lists of scalars, flow lists [a, b], and one level of nested maps.
// It deliberately does not try to be a full YAML implementation.

export function splitFrontmatter(text) {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!src.startsWith('---\n') && src.trim() !== '---') return { data: {}, body: src };
  const end = src.indexOf('\n---', 4);
  if (end === -1) return { data: {}, body: src };
  const fm = src.slice(4, end);
  let body = src.slice(end + 4);
  body = body.replace(/^[^\n]*\n?/, ''); // drop rest of the closing --- line
  return { data: parseYaml(fm), body };
}

export function parseYaml(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  return parseMap(lines, 0, lines.length, 0);
}

const indentOf = (l) => l.match(/^ */)[0].length;
const isBlank = (l) => /^\s*(#.*)?$/.test(l);

function parseMap(lines, start, end, indent) {
  const out = {};
  let i = start;
  while (i < end) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }
    const ind = indentOf(line);
    if (ind < indent) break;
    const m = line.slice(ind).match(/^("[^"]*"|'[^']*'|[^:#][^:]*?)\s*:(?:\s+|$)(.*)$/);
    if (!m || ind !== indent) { i++; continue; }
    const key = unquoteKey(m[1]);
    const rest = m[2];
    // find the extent of this entry: following lines indented deeper (or blank)
    let j = i + 1;
    while (j < end && (isBlank(lines[j]) || indentOf(lines[j]) > indent)) j++;
    // a list at the same indent also belongs to the key ("key:\n- a")
    if (rest.trim() === '' && j < end && indentOf(lines[j]) === indent && /^\s*- /.test(lines[j])) {
      while (j < end && (isBlank(lines[j]) || indentOf(lines[j]) > indent || (indentOf(lines[j]) === indent && /^\s*-( |$)/.test(lines[j])))) j++;
    }
    out[key] = parseValue(rest, lines.slice(i + 1, j), indent);
    i = j;
  }
  return out;
}

function unquoteKey(k) {
  k = k.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) return k.slice(1, -1);
  return k;
}

function parseValue(rest, child, parentIndent) {
  const v = rest.trim();
  if (v === '' || v.startsWith('#')) {
    const content = child.filter((l) => !isBlank(l));
    if (!content.length) return null;
    if (/^\s*-( |$)/.test(content[0])) return parseList(child);
    const ind = indentOf(content[0]);
    if (/^\s*[^:]+:(\s|$)/.test(content[0])) return parseMap(child, 0, child.length, ind);
    return foldPlain([], child);
  }
  if (v[0] === '|' || v[0] === '>') return blockScalar(v, child);
  if (v[0] === '"' || v[0] === "'") return quoted([v, ...child.map((l) => l.trim())].join('\n'));
  if (v[0] === '[') return flowList([v, ...child.map((l) => l.trim())].join(' '));
  return scalar(foldPlain([stripComment(v)], child));
}

function stripComment(s) {
  const k = s.search(/\s#/);
  return (k === -1 ? s : s.slice(0, k)).trim();
}

function foldPlain(first, child) {
  const parts = [...first];
  let out = parts.join('');
  for (const l of child) {
    const t = l.trim();
    if (t === '') { out += '\n'; continue; }
    out += (out === '' || out.endsWith('\n') ? '' : ' ') + stripComment(t);
  }
  return out.trim();
}

function blockScalar(head, child) {
  const literal = head[0] === '|';
  const chomp = head.includes('-') ? 'strip' : head.includes('+') ? 'keep' : 'clip';
  const content = child.filter((l) => l.trim() !== '');
  const ind = content.length ? indentOf(content[0]) : 0;
  const raw = child.map((l) => (l.trim() === '' ? '' : l.slice(ind)));
  while (raw.length && raw[raw.length - 1] === '' && chomp !== 'keep') raw.pop();
  let text;
  if (literal) text = raw.join('\n');
  else {
    text = '';
    for (let k = 0; k < raw.length; k++) {
      const l = raw[k];
      if (l === '') text += '\n';
      else if (text === '' || text.endsWith('\n')) text += l;
      else if (/^\s/.test(l) || /^\s/.test(raw[k - 1] || '')) text += '\n' + l;
      else text += ' ' + l;
    }
  }
  if (chomp === 'clip') return text + (text ? '\n' : '');
  if (chomp === 'keep') return text + '\n';
  return text;
}

function quoted(s) {
  const q = s[0];
  let i = 1, out = '';
  while (i < s.length) {
    const c = s[i];
    if (q === "'" && c === "'" && s[i + 1] === "'") { out += "'"; i += 2; continue; }
    if (c === q) break;
    if (q === '"' && c === '\\') {
      const n = s[i + 1];
      const map = { n: '\n', t: '\t', '"': '"', '\\': '\\', '/': '/', r: '\r', '0': '\0', ' ': ' ' };
      if (n === 'u') { out += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16)); i += 6; continue; }
      if (n === '\n') { i += 2; while (s[i] === ' ') i++; continue; }
      out += map[n] ?? n; i += 2; continue;
    }
    if (c === '\n') {
      // folding: a single line break becomes a space, an empty line a newline
      let k = i + 1, breaks = 0;
      while (k < s.length && (s[k] === '\n' || s[k] === ' ')) { if (s[k] === '\n') breaks++; k++; }
      out = out.replace(/ +$/, '');
      out += breaks ? '\n'.repeat(breaks) : ' ';
      i = k; continue;
    }
    out += c; i++;
  }
  return out;
}

function flowList(s) {
  const inner = s.slice(s.indexOf('[') + 1, s.lastIndexOf(']'));
  const items = [];
  let cur = '', q = null;
  for (const c of inner) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === ',') { items.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() !== '') items.push(cur);
  return items.map((x) => x.trim()).filter((x) => x !== '').map((x) => (x[0] === '"' || x[0] === "'" ? quoted(x) : scalar(x)));
}

function parseList(child) {
  const content = child.filter((l) => !isBlank(l));
  const ind = indentOf(content[0]);
  const items = [];
  let cur = null;
  for (const l of child) {
    if (!isBlank(l) && indentOf(l) === ind && /^\s*-( |$)/.test(l)) {
      if (cur) items.push(cur);
      cur = { head: l.slice(ind + 1).replace(/^ /, ''), rest: [] };
    } else if (cur) cur.rest.push(l);
  }
  if (cur) items.push(cur);
  return items.map(({ head, rest }) => {
    const h = head.trim();
    // list of maps: "- key: value"
    if (/^[^"'\[|>][^:]*:(\s|$)/.test(h) && !/^https?:/.test(h)) {
      const pad = ' '.repeat(ind + 2);
      const lines = [pad + h, ...rest];
      return parseMap(lines, 0, lines.length, ind + 2);
    }
    return parseValue(h, rest, ind);
  });
}

function scalar(v) {
  if (typeof v !== 'string') return v;
  if (v.includes('\n')) return v;
  if (/^(true|True|TRUE)$/.test(v)) return true;
  if (/^(false|False|FALSE)$/.test(v)) return false;
  if (/^(null|Null|NULL|~)$/.test(v) || v === '') return null;
  if (/^-?\d+$/.test(v) && v.length < 16 && !/^0\d/.test(v)) return Number(v);
  if (/^-?\d+\.\d+$/.test(v)) return Number(v);
  return v;
}
