// HTML templates. Every value from content is escaped with esc() unless it
// is HTML produced by the markdown converter.
import { esc } from './markdown.mjs';

export const LOCALES = ['en', 'hi'];
export const href = (lang, path) => (lang === 'en' ? path : `/hi${path}`);
// English pages skip the Devanagari font; Hindi pages need it. Loaded without blocking the page.
const fontHref = (lang) => `https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600${lang === 'hi' ? '&family=Noto+Sans+Devanagari:wght@400;500;600;700' : ''}&display=swap`;

// Visible breadcrumb trail plus matching BreadcrumbList structured data.
export function crumbs(ctx, items) {
  const { lang, settings } = ctx;
  const site = settings.site_url.replace(/\/$/, '');
  const all = [[lang === 'hi' ? 'होम' : 'Home', '/'], ...items];
  const html = `<nav class="crumbs" aria-label="Breadcrumb"><ol>${all.map(([name, path], i) => i < all.length - 1
    ? `<li><a href="${href(lang, path)}">${esc(name)}</a></li>` : `<li aria-current="page">${esc(name)}</li>`).join('')}</ol></nav>`;
  const ld = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: all.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: site + href(lang, path) })) };
  return { html, ld };
}
const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

const ICONS = {
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  ship: '<path d="M3 17l2 4h14l2-4H3z"/><path d="M5 17V9h14v8M12 9V3M9 6h6"/>',
  rupee: '<path d="M7 4h11M7 9h11M7 4c6 0 6 9 0 9h-1l8 8"/>',
  rocket: '<path d="M5 15c-1 2-1 4-1 4s2 0 4-1M9 18l-3-3c1-5 5-11 13-12-1 8-7 12-12 13z"/><circle cx="15" cy="9" r="1.5"/>',
  check: '<path d="M5 12l4 4 10-10"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  minus: '<path d="M6 12h12"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5z"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
};
export const icon = (name, cls = 'icon') =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.globe}</svg>`;

const WA_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3a13 13 0 00-11.2 19.6L3 29l6.6-1.7A13 13 0 1016 3zm0 23.6c-2 0-3.9-.5-5.6-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.6 10.6 0 1116 26.6zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.7 8.7 0 01-4.3-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 00-.9.4 3.7 3.7 0 00-1.2 2.8 6.5 6.5 0 001.4 3.4 14.8 14.8 0 005.6 5c2.1.9 2.9 1 4 .8a3.4 3.4 0 002.2-1.6 2.8 2.8 0 00.2-1.6c-.1-.1-.3-.2-.6-.3z"/></svg>';

export function waLink(settings, lang) {
  const msg = lang === 'hi' ? settings.whatsapp_message_hi : settings.whatsapp_message_en;
  return `https://wa.me/${encodeURIComponent(String(settings.whatsapp || '').replace(/\D/g, ''))}?text=${encodeURIComponent(msg || '')}`;
}

export function layout(ctx, { title, description, path, body, alternates = LOCALES, noindex = false, jsonld = null, ogType = 'website' }) {
  const { lang, t, settings, assets } = ctx;
  const site = settings.site_url.replace(/\/$/, '');
  const url = site + href(lang, path);
  const fullTitle = path === '/' ? title : `${title} | ${settings.site_name}`;
  const alt = alternates.map((l) => `<link rel="alternate" hreflang="${l}" href="${site}${href(l, path)}">`).join('\n');
  const xdef = alternates.includes('en') ? `<link rel="alternate" hreflang="x-default" href="${site}${href('en', path)}">` : '';
  const other = lang === 'en' ? 'hi' : 'en';
  const switchHref = alternates.includes(other) ? href(other, path) : href(other, '/');
  const nav = [
    ['/services/', t.nav.services], ['/markets/', t.nav.markets], ['/schemes/', t.nav.schemes],
    ['/insights/', t.nav.insights], ['/about/', t.nav.about], ['/contact/', t.nav.contact],
  ];
  const active = (p) => (path === p || (p !== '/' && path.startsWith(p)) ? ' aria-current="page"' : '');
  return `<!doctype html>
<html lang="${lang === 'hi' ? 'hi-IN' : 'en-IN'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
${alt}
${xdef}
${noindex ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">'}
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${site}/images/og-default.png">
<meta property="og:locale" content="${lang === 'hi' ? 'hi_IN' : 'en_IN'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0A2E5C">
<link rel="icon" href="/images/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="${fontHref(lang)}" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="${fontHref(lang)}"></noscript>
<link rel="stylesheet" href="${assets.css}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="lang-${lang}">
<a class="skip" href="#main">${esc(t.skip)}</a>
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="${href(lang, '/')}" aria-label="${esc(settings.site_name)} home"><img src="/images/globlix-logo.png" alt="${esc(settings.site_name)}" width="150" height="87"></a>
    <button class="menu-toggle" aria-expanded="false" aria-controls="site-nav">${esc(t.nav.menu)}</button>
    <nav id="site-nav" class="site-nav" aria-label="Main">
      <ul>${nav.map(([p, label]) => `<li><a href="${href(lang, p)}"${active(p)}>${esc(label)}</a></li>`).join('')}</ul>
      <a class="lang-switch" href="${switchHref}" hreflang="${other}" lang="${other}">${esc(t.switch_to)}</a>
      <a class="btn btn-accent btn-sm" href="${href(lang, '/free-hsn-snapshot/')}">${esc(t.nav.cta)}</a>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
${footer(ctx)}
<a class="wa-float" href="${waLink(settings, lang)}" target="_blank" rel="noopener" aria-label="${esc(t.common.whatsapp)}">${WA_SVG}<span>${esc(t.common.whatsapp)}</span></a>
<script src="${assets.js}" defer></script>
</body>
</html>`;
}

function footer({ lang, t, settings, services }) {
  const social = [['google_business_url', lang === 'hi' ? 'Google पर देखें' : 'Find us on Google'], ['linkedin', 'LinkedIn'], ['instagram', 'Instagram'], ['youtube', 'YouTube']]
    .filter(([k]) => settings[k]).map(([k, n]) => `<li><a href="${esc(settings[k])}" target="_blank" rel="noopener">${n}</a></li>`).join('');
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <img class="footer-logo" src="/images/globlix-logo.png" alt="${esc(settings.site_name)}" width="150" height="87">
      <p>${esc(t.footer.about)}</p>
      <p class="muted">${esc(fill(t.footer.backed, settings))}</p>
    </div>
    <div>
      <h2 class="footer-h">${esc(t.nav.services)}</h2>
      <ul>${services.map((s) => `<li><a href="${href(lang, `/services/${s.slug}/`)}">${esc(s.title)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h2 class="footer-h">${esc(t.footer.explore)}</h2>
      <ul>
        <li><a href="${href(lang, '/markets/')}">${esc(t.nav.markets)}</a></li>
        <li><a href="${href(lang, '/schemes/')}">${esc(t.nav.schemes)}</a></li>
        <li><a href="${href(lang, '/insights/')}">${esc(t.nav.insights)}</a></li>
        <li><a href="${href(lang, '/about/')}">${esc(t.nav.about)}</a></li>
        <li><a href="${href(lang, '/privacy/')}">${esc(t.footer.privacy)}</a></li>
        <li><a href="${href(lang, '/terms/')}">${esc(t.footer.terms)}</a></li>
      </ul>
    </div>
    <div>
      <h2 class="footer-h">${esc(t.footer.contact)}</h2>
      <ul>
        <li><a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a></li>
        <li><a href="tel:${esc(String(settings.phone).replace(/[^\d+]/g, ''))}">${esc(settings.phone)}</a></li>
        <li><a href="${waLink(settings, lang)}" target="_blank" rel="noopener">${esc(t.common.whatsapp)}</a></li>
        ${settings.address ? `<li>${esc(settings.address)}</li>` : ''}
        ${social}
      </ul>
    </div>
  </div>
  <div class="wrap footer-base"><p>© ${new Date().getFullYear()} ${esc(settings.site_name)}. ${esc(t.footer.rights)}</p></div>
</footer>`;
}

export function pageHero(eyebrow, title, intro) {
  return `<section class="page-hero"><div class="wrap">
  ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
  <h1>${esc(title)}</h1>
  ${intro ? `<p class="lead">${esc(intro)}</p>` : ''}
</div></section>`;
}

export function ctaBand(ctx, title, text) {
  const { lang, t } = ctx;
  return `<section class="cta-band"><div class="wrap cta-row">
  <div><h2>${esc(title)}</h2><p>${esc(text)}</p></div>
  <div class="cta-actions">
    <a class="btn btn-accent" href="${href(lang, '/free-hsn-snapshot/')}">${esc(t.common.get_snapshot)}</a>
    <a class="btn btn-ghost-light" href="${waLink(ctx.settings, lang)}" target="_blank" rel="noopener">${esc(t.common.whatsapp)}</a>
  </div>
</div></section>`;
}

export function postCard(ctx, p) {
  const { lang, t } = ctx;
  return `<article class="card post-card">
  <p class="meta">${esc(ctx.fmtDate(p.date))}${p.tags?.length ? ` · ${esc(p.tags.slice(0, 2).join(', '))}` : ''}</p>
  <h3><a href="${href(lang, `/insights/${p.slug}/`)}">${esc(p.title)}</a></h3>
  <p>${esc(p.description)}</p>
  <a class="more" href="${href(lang, `/insights/${p.slug}/`)}" aria-label="${esc(t.common.read_more)}: ${esc(p.title)}">${esc(t.common.read_more)} ${icon('arrow', 'icon-sm')}</a>
</article>`;
}

export const MARKET_VALUES = ['USA', 'European Union', 'United Kingdom', 'Middle East', 'Australia', 'Japan', 'Canada', 'Latin America', 'Not sure yet'];

// Every form keeps the same field names in every language, so the Google
// Sheet and HubSpot get the same columns whichever page a lead came from.
// All forms post to the Cloudflare Pages Function at /api/lead.
// Optional Cloudflare Turnstile spam check, shown only when a site key is set
// in Site settings (and TURNSTILE_SECRET is set in Cloudflare).
function turnstile(ctx) {
  const key = String(ctx.settings.turnstile_site_key || '').trim();
  if (!key) return '';
  return `<div class="cf-turnstile" data-sitekey="${esc(key)}" data-language="${ctx.lang}" data-size="flexible"></div>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`;
}

export function leadForm(ctx, kind, path) {
  const { lang, t } = ctx;
  const f = t.forms;
  const name = kind === 'snapshot' ? 'hsn-snapshot' : kind === 'quick' ? 'quick-enquiry' : 'contact';
  const req = `<span class="req" aria-hidden="true">*</span>`;
  const field = (id, label, input, hint = '') => `<div class="field"><label for="${name}-${id}">${label}</label>${input}${hint ? `<p class="hint" id="${name}-${id}-hint">${esc(hint)}</p>` : ''}</div>`;
  const text = (id, type = 'text', opts = '') => `<input id="${name}-${id}" name="${id}" type="${type}" ${opts}>`;
  const common = [
    field('name', `${esc(f.name)} ${req}`, text('name', 'text', 'required autocomplete="name" maxlength="120"')),
    field('email', `${esc(f.email)} ${req}`, text('email', 'email', 'required autocomplete="email" maxlength="160"')),
    field('phone', `${esc(f.phone)} ${req}`, text('phone', 'tel', 'required autocomplete="tel" inputmode="tel" maxlength="20" pattern="[0-9+()\\- ]{8,20}"')),
    field('company', esc(f.company), text('company', 'text', 'autocomplete="organization" maxlength="160"')),
  ];
  let extra = '';
  if (kind === 'quick') {
    common.splice(3, 1, field('product', `${esc(f.product)} ${req}`, text('product', 'text', 'required maxlength="200"')));
  }
  if (kind === 'snapshot') {
    extra = [
      field('location', esc(f.location), text('location', 'text', 'autocomplete="address-level2" maxlength="120"')),
      field('product', `${esc(f.product)} ${req}`, text('product', 'text', 'required maxlength="200"')),
      field('hsn_code', esc(f.hsn_code), text('hsn_code', 'text', `inputmode="numeric" pattern="[0-9]{4}([0-9]{2}){0,2}" maxlength="8" aria-describedby="${name}-hsn_code-hint"`), f.hsn_hint),
      `<fieldset class="field"><legend>${esc(f.export_status)} ${req}</legend><div class="choices">${[['new', f.status_new], ['growing', f.status_some], ['stuck', f.status_stuck]]
        .map(([v, l], i) => `<label class="choice"><input type="radio" name="export_status" value="${v}"${i === 0 ? ' required' : ''}> ${esc(l)}</label>`).join('')}</div></fieldset>`,
      `<fieldset class="field field-wide"><legend>${esc(f.target_markets)}</legend><div class="choices">${MARKET_VALUES
        .map((v, i) => `<label class="choice"><input type="checkbox" name="target_markets" value="${esc(v)}"> ${esc(f.markets[i] || v)}</label>`).join('')}</div></fieldset>`,
      field('monthly_capacity', esc(f.monthly_capacity), text('monthly_capacity', 'text', `maxlength="120" aria-describedby="${name}-monthly_capacity-hint"`), f.capacity_hint),
    ].join('\n');
  }
  const message = kind === 'quick' ? '' : `<div class="field field-wide"><label for="${name}-message">${esc(f.message)}${kind === 'contact' ? ` ${req}` : ''}</label><textarea id="${name}-message" name="message" rows="5" maxlength="2000"${kind === 'contact' ? ' required' : ''}></textarea></div>`;
  return `<form class="lead-form${kind === 'quick' ? ' lead-form-quick' : ''}" name="${name}" method="POST" action="/api/lead" data-thanks="${href(lang, '/thank-you/')}" data-error="${esc(f.error)}" data-sending="${esc(f.sending)}" data-wa="${esc(String(ctx.settings.whatsapp || '').replace(/\D/g, ''))}" data-wa-label="${esc(f.wa_fallback)}">
  <input type="hidden" name="form-name" value="${name}">
  <p class="hp" aria-hidden="true"><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
  <input type="hidden" name="lang" value="${lang}">
  <input type="hidden" name="page" value="${esc(href(lang, path))}">
  <input type="hidden" name="utm_source" value="">
  <input type="hidden" name="utm_medium" value="">
  <input type="hidden" name="utm_campaign" value="">
  <div class="form-grid">
  ${common.join('\n')}
  ${extra}
  ${message}
  </div>
  <label class="consent"><input type="checkbox" name="consent" value="yes" required> <span>${esc(f.consent)} <a href="${href(lang, '/privacy/')}">${esc(f.consent_link)}</a>. ${req}</span></label>
  ${turnstile(ctx)}
  <p class="form-error" role="alert" hidden></p>
  <button class="btn btn-accent" type="submit">${esc(kind === 'snapshot' ? f.submit_snapshot : kind === 'quick' ? ctx.t.quick.submit : f.submit_contact)}</button>
</form>`;
}

// ---------- Infographic components ----------
const STATUS_ICON = { zero: 'check', soon: 'clock', partial: 'down', normal: 'minus', extra: 'up' };
const STATUSES = ['zero', 'soon', 'partial', 'normal', 'extra'];

export function statusBadge(t, status) {
  return `<span class="status status-${status}">${icon(STATUS_ICON[status] || 'minus', 'icon-sm')} ${esc(t.markets_ui[`status_${status}`] || status)}</span>`;
}

export function marketBoard(ctx, mk, { only = null, compact = false } = {}) {
  const { t } = ctx;
  const list = mk.markets.filter((m) => !only || only.includes(m.status));
  const card = (m) => `<li class="mcard mcard-${m.status}"><div class="mcard-top"><h3>${esc(m.name)}</h3>${statusBadge(t, m.status)}</div><p>${esc(m.note)}</p></li>`;
  if (compact) return `<ul class="mboard mboard-compact">${list.map(card).join('')}</ul>`;
  const group = (g) => list.filter((m) => m.group === g);
  return `<div class="legend" aria-label="${esc(t.markets_ui.legend)}">${STATUSES.map((s) => statusBadge(t, s)).join('')}</div>
${['established', 'new'].map((g) => `<h3 class="mgroup">${esc(t.markets_ui[g])}</h3><ul class="mboard">${group(g).map(card).join('')}</ul>`).join('')}`;
}

export function timeline(mk) {
  return `<ol class="tline">${mk.timeline.map((e, i) => `<li${i === mk.timeline.length - 1 ? ' class="is-next"' : ''}><span class="tdate">${esc(e.date)}</span><span class="tdot" aria-hidden="true"></span><span class="ttext">${esc(e.text)}</span></li>`).join('')}</ol>`;
}

export function factsStrip(home) {
  return `<div class="facts">${(home.facts || []).map((f) => `<div class="fact"><p class="fact-value">${esc(f.value)}</p><p class="fact-label">${esc(f.label)}</p><p class="fact-source">${esc(f.source)}</p></div>`).join('')}</div>`;
}

export function problemsViz(ctx, home) {
  const { t } = ctx;
  return `<div class="pviz">
  <div class="pviz-head" aria-hidden="true"><span>${esc(t.problem_label)}</span><span></span><span>${esc(t.solution_label)}</span></div>
  <ol class="pviz-list">${(home.problems || []).map((p) => `<li class="pviz-row"><p class="pviz-problem"><span class="sr-only">${esc(t.problem_label)}: </span>${esc(p.problem)}</p><span class="pviz-arrow" aria-hidden="true">${icon('arrow')}</span><p class="pviz-solution">${icon(p.icon || 'check')}<span><span class="sr-only">${esc(t.solution_label)}: </span>${esc(p.solution)}</span></p></li>`).join('')}</ol>
</div>`;
}

export function journey(home) {
  const icons = ['search', 'chat', 'clipboard', 'ship'];
  return `<ol class="journey">${(home.steps || []).map((s, i) => `<li><span class="jicon" aria-hidden="true">${icon(icons[i] || 'check')}</span><span class="jnum">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('')}</ol>`;
}
