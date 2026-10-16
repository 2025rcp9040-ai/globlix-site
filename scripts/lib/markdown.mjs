// Small, safe Markdown-to-HTML converter for content written in Decap CMS.
// Raw HTML is escaped, never passed through. Supports headings, paragraphs,
// emphasis, inline code, links, images, lists (nested by indent), blockquotes,
// fenced code, horizontal rules and GitHub-style tables.

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function safeUrl(u) {
  const url = String(u || '').trim();
  if (/^(https?:|mailto:|tel:|\/|#|\.\/|\.\.\/)/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return '#'; // javascript:, data:, etc.
  return url;
}

export function inline(text) {
  const codes = [];
  let s = String(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = esc(s);
  // images then links (operate on escaped text; quotes were escaped to entities)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, alt, src, title) =>
    `<img src="${esc(safeUrl(unesc(src)))}" alt="${alt}" loading="lazy"${title ? ` title="${title}"` : ''}>`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, label, href, title) => {
    const url = safeUrl(unesc(href));
    const ext = /^https?:/i.test(url) && !/^https?:\/\/(www\.)?globlix\.in/i.test(url);
    return `<a href="${esc(url)}"${title ? ` title="${title}"` : ''}${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/ {2,}\n|\\\n/g, '<br>\n');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
}

const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const RE = {
  fence: /^\s*(```|~~~)\s*([\w-]*)\s*$/,
  heading: /^(#{1,6})\s+(.*?)\s*#*\s*$/,
  hr: /^\s*([-*_])(\s*\1){2,}\s*$/,
  quote: /^\s*>\s?/,
  ul: /^(\s*)[-*+]\s+(.*)$/,
  ol: /^(\s*)(\d+)[.)]\s+(.*)$/,
  tableSep: /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/,
};

export function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function markdown(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  return blocks(lines).join('\n');
}

function blocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }
    let m;
    if ((m = line.match(RE.fence))) {
      const fence = m[1];
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) buf.push(lines[i++]);
      i++;
      const kind = m[2].toLowerCase();
      if (VISUALS[kind]) { out.push(VISUALS[kind](buf)); continue; }
      out.push(`<pre><code${m[2] ? ` class="language-${esc(m[2])}"` : ''}>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if ((m = line.match(RE.heading))) {
      const lvl = Math.max(2, m[1].length); // page title is the only h1
      out.push(`<h${lvl} id="${slugify(m[2])}">${inline(m[2])}</h${lvl}>`);
      i++; continue;
    }
    if (RE.hr.test(line)) { out.push('<hr>'); i++; continue; }
    if (RE.quote.test(line)) {
      const buf = [];
      while (i < lines.length && lines[i].trim() !== '' && RE.quote.test(lines[i])) buf.push(lines[i++].replace(RE.quote, ''));
      out.push(`<blockquote>${blocks(buf).join('\n')}</blockquote>`);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && RE.tableSep.test(lines[i + 1])) {
      const rows = [];
      const aligns = cells(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : ''));
      const head = cells(line);
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') rows.push(cells(lines[i++]));
      const al = (k) => (aligns[k] ? ` style="text-align:${aligns[k]}"` : '');
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c, k) => `<th${al(k)}>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((r) => `<tr>${head.map((_, k) => `<td${al(k)}>${inline(r[k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (RE.ul.test(line) || RE.ol.test(line)) {
      const res = list(lines, i);
      out.push(res.html);
      i = res.next;
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines, i)) buf.push(lines[i++]);
    if (!buf.length) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join('\n').trim())}</p>`);
  }
  return out;
}

function startsBlock(lines, i) {
  const l = lines[i];
  return RE.fence.test(l) || RE.heading.test(l) || RE.hr.test(l) || RE.quote.test(l) || RE.ul.test(l) || RE.ol.test(l) ||
    (l.includes('|') && i + 1 < lines.length && RE.tableSep.test(lines[i + 1]));
}

function cells(row) {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

function list(lines, start) {
  const first = lines[start];
  const ordered = RE.ol.test(first) && !RE.ul.test(first);
  const baseIndent = first.match(/^\s*/)[0].length;
  const items = [];
  let i = start;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === '') {
      // a blank line ends the list unless the next line continues it
      const n = lines[i + 1];
      if (n !== undefined && (n.match(/^\s*/)[0].length > baseIndent || (n.match(/^\s*/)[0].length === baseIndent && (ordered ? RE.ol : RE.ul).test(n)))) { i++; continue; }
      break;
    }
    const ind = l.match(/^\s*/)[0].length;
    const m = ordered ? l.match(RE.ol) : l.match(RE.ul);
    if (m && ind === baseIndent) {
      items.push([ordered ? m[3] : m[2]]);
      i++;
      continue;
    }
    if (ind > baseIndent && items.length) {
      items[items.length - 1].push(l.slice(Math.min(ind, baseIndent + 2)));
      i++;
      continue;
    }
    break;
  }
  const tag = ordered ? 'ol' : 'ul';
  const startAttr = ordered ? Number(first.match(RE.ol)[2]) : 1;
  const html = `<${tag}${ordered && startAttr !== 1 ? ` start="${startAttr}"` : ''}>${items
    .map(([head, ...rest]) => {
      const nested = rest.length ? blocks(rest).join('') : '';
      return `<li>${inline(head)}${nested}</li>`;
    }).join('')}</${tag}>`;
  return { html, next: i };
}

export function excerpt(md, n = 180) {
  const text = String(md || '').replace(/```[\s\S]*?```/g, '').replace(/[#>*_`|\-\[\]()!]/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > n ? text.slice(0, n).replace(/\s+\S*$/, '') + '…' : text;
}

// ---------------------------------------------------------------------------
// Visual blocks that editors can type in the CMS as fenced blocks.
//
// ```chart                         horizontal bar chart
// title: Carpet imports, 2023
// unit: USD bn
// highlight: India
// source: UN Comtrade via TrendEconomy
// USA | 3.42
// Germany | 1.16
// ```
//
// ```stats                         big-number tiles: value | label | source
// 38% | of world hand-knotted rug exports | UN Comtrade, 2023
// ```
//
// ```steps                         numbered process flow: title | text
// Ship | We book freight and file documents
// ```
// ---------------------------------------------------------------------------

function parseVisual(lines) {
  const meta = {};
  const rows = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    const mm = l.match(/^(title|unit|source|highlight|note):\s*(.*)$/i);
    if (mm && !l.includes('|')) { meta[mm[1].toLowerCase()] = mm[2].trim(); continue; }
    rows.push(l.split('|').map((x) => x.trim()));
  }
  return { meta, rows };
}

const num = (s) => Number(String(s).replace(/[^\d.\-]/g, ''));
const fmtNum = (v) => (Math.abs(v) >= 1000 ? v.toLocaleString('en-IN') : String(v));

function chartBlock(lines) {
  const { meta, rows } = parseVisual(lines);
  const data = rows.filter((r) => r.length >= 2 && Number.isFinite(num(r[1]))).map((r) => ({ label: r[0], value: num(r[1]), shown: r[1] }));
  if (!data.length) return '';
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const hl = (meta.highlight || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  const unit = meta.unit ? ` ${meta.unit}` : '';
  const bars = data.map((d) => {
    const isHl = hl.includes(d.label.toLowerCase());
    const r = Math.max(d.value / max, 0.004).toFixed(4);
    return `<div class="bar-row${isHl ? ' is-hl' : ''}" title="${esc(d.label)}: ${esc(d.shown)}${esc(unit)}"><span class="bar-label">${esc(d.label)}</span><span class="bar-track"><span class="bar" style="--r:${r}"></span><span class="bar-value">${esc(d.shown)}</span></span></div>`;
  }).join('');
  return `<figure class="viz-chart">${meta.title ? `<figcaption class="viz-title">${inline(meta.title)}${unit ? ` <span class="viz-unit">(${esc(meta.unit)})</span>` : ''}</figcaption>` : ''}
<div class="bars" aria-hidden="true">${bars}</div>
<table class="sr-only"><caption>${esc(meta.title || 'Chart data')}</caption><tbody>${data.map((d) => `<tr><th scope="row">${esc(d.label)}</th><td>${esc(d.shown)}${esc(unit)}</td></tr>`).join('')}</tbody></table>
${meta.note ? `<p class="viz-note">${inline(meta.note)}</p>` : ''}${meta.source ? `<p class="viz-source">Source: ${inline(meta.source)}</p>` : ''}</figure>`;
}

function statsBlock(lines) {
  const { meta, rows } = parseVisual(lines);
  return `<div class="viz-stats">${rows.map((r) => `<div class="stat"><p class="stat-value">${esc(r[0])}</p><p class="stat-label">${inline(r[1] || '')}</p>${r[2] ? `<p class="stat-source">${inline(r[2])}</p>` : ''}</div>`).join('')}</div>${meta.source ? `<p class="viz-source">Source: ${inline(meta.source)}</p>` : ''}`;
}

function stepsBlock(lines) {
  const { meta, rows } = parseVisual(lines);
  return `<ol class="viz-steps">${rows.map((r) => `<li><p class="step-title">${inline(r[0])}</p>${r[1] ? `<p class="step-text">${inline(r[1])}</p>` : ''}</li>`).join('')}</ol>${meta.note ? `<p class="viz-note">${inline(meta.note)}</p>` : ''}`;
}

const VISUALS = { chart: chartBlock, stats: statsBlock, steps: stepsBlock };
