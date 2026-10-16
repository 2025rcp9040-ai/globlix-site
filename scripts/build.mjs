// Globlix static site build. No dependencies: run with `node scripts/build.mjs`.
// Reads content/ (edited in Decap CMS), renders English pages at / and Hindi
// pages at /hi/, and writes the finished site to dist/.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter } from './lib/yaml.mjs';
import { markdown, esc, excerpt } from './lib/markdown.mjs';
import { LOCALES, href, layout, pageHero, ctaBand, postCard, leadForm, icon, waLink, marketBoard, timeline, factsStrip, problemsViz, journey, crumbs } from './lib/templates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, process.env.OUT_DIR || 'dist');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const exists = (p) => fs.existsSync(path.join(ROOT, p));

function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dest, entry.name);
    if (entry.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyDir(s, d); } else fs.copyFileSync(s, d);
  }
}

function loadFolder(rel, lang) {
  const dir = path.join(ROOT, rel, lang);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const { data, body } = splitFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { ...data, slug: f.replace(/\.md$/, ''), body: body.trim() };
  });
}

function asDate(d) {
  if (!d) return null;
  const v = new Date(d);
  return Number.isNaN(v.getTime()) ? null : v;
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const settings = readJson('content/settings.json');
  const site = settings.site_url.replace(/\/$/, '');

  // fingerprinted assets so browsers can cache them for a year
  const css = read('src/styles/site.css');
  const js = read('src/js/site.js');
  const h = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
  const assets = { css: `/assets/site.${h(css)}.css`, js: `/assets/site.${h(js)}.js` };
  write(assets.css, css);
  write(assets.js, js);
  copyDir(path.join(ROOT, 'static'), OUT);

  const content = {};
  for (const lang of LOCALES) {
    content[lang] = {
      t: readJson(`src/i18n/${lang}.json`),
      home: readJson(`content/home/${lang}.json`),
      mk: readJson(`content/markets/${lang}.json`),
      services: loadFolder('content/services', lang).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
      pages: Object.fromEntries(loadFolder('content/pages', lang).map((p) => [p.slug, p])),
      posts: loadFolder('content/blog', lang)
        .filter((p) => p.draft !== true && p.title && p.body)
        .map((p) => ({ ...p, dateObj: asDate(p.date) }))
        .sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0)),
    };
  }
  const has = (lang, kind, slug) => (kind === 'post' ? content[lang].posts.some((p) => p.slug === slug)
    : kind === 'service' ? content[lang].services.some((s) => s.slug === slug) : !!content[lang].pages[slug]);
  const altsFor = (kind, slug) => LOCALES.filter((l) => has(l, kind, slug));
  const sitemap = [];
  const emit = (lang, pathName, html, alternates = LOCALES, index = true) => {
    write(path.join(lang === 'en' ? '' : 'hi', pathName, pathName.endsWith('.html') ? '' : 'index.html'), html);
    if (index) sitemap.push({ path: pathName, lang, alternates });
  };

  for (const lang of LOCALES) {
    const { t, home, services, pages, posts, mk } = content[lang];
    const fmt = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const ctx = { lang, t, settings, services, assets, fmtDate: (d) => (asDate(d) ? fmt.format(asDate(d)) : '') };
    const orgId = `${site}/#organization`;
    const founder = settings.founder_name ? { '@type': 'Person', name: settings.founder_name, jobTitle: settings.founder_role || undefined, sameAs: settings.founder_linkedin ? [settings.founder_linkedin] : undefined } : undefined;
    const org = {
      '@context': 'https://schema.org', '@type': 'ProfessionalService', '@id': orgId, name: settings.site_name, alternateName: settings.business_name || undefined, url: site,
      logo: `${site}/images/globlix-logo.png`, image: `${site}/images/og-default.png`,
      description: home.seo_description, slogan: settings.tagline_en,
      email: settings.email, telephone: settings.phone.replace(/\s/g, ''),
      areaServed: { '@type': 'Country', name: 'India' }, knowsLanguage: ['en', 'hi'],
      address: settings.address ? { '@type': 'PostalAddress', streetAddress: settings.address, addressCountry: 'IN' } : { '@type': 'PostalAddress', addressCountry: 'IN' },
      contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', telephone: settings.phone.replace(/\s/g, ''), email: settings.email, availableLanguage: ['English', 'Hindi'] },
      knowsAbout: ['Export consultancy', 'HSN code market research', 'IEC and RCMC registration', 'Certificate of origin', 'RoDTEP', 'Export freight', 'Handicraft exports', 'Textile exports', 'Carpet and rug exports'],
      founder,
      sameAs: ['google_business_url', 'linkedin', 'instagram', 'youtube'].map((k) => settings[k]).filter(Boolean),
      hasOfferCatalog: { '@type': 'OfferCatalog', name: t.services.title, itemListElement: services.map((x) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: x.title, description: x.summary, url: `${site}${href(lang, `/services/${x.slug}/`)}` } })) },
    };
    const website = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${site}/#website`, name: settings.site_name, url: site, inLanguage: ['en-IN', 'hi-IN'], publisher: { '@id': orgId } };

    // Home: built for conversion. Hero with a quick enquiry form, problems
    // mapped to services, proof numbers, process, duty-free markets, FAQ.
    const svc = Object.fromEntries(services.map((x) => [x.slug, x]));
    const homeBody = `
<section class="hero hero-pro"><div class="wrap hero-grid">
  <div class="hero-copy">
    <p class="eyebrow">${esc(home.hero_eyebrow)}</p>
    <h1>${esc(home.hero_title)}</h1>
    <p class="lead">${esc(home.hero_text)}</p>
    <ul class="hero-points">${(home.hero_points || []).map((x) => `<li>${icon('check')} ${esc(x)}</li>`).join('')}</ul>
    <div class="hero-actions">
      <a class="btn btn-accent" href="${href(lang, '/free-hsn-snapshot/')}">${esc(home.cta_primary)} ${icon('arrow', 'icon-sm')}</a>
      <a class="btn btn-ghost-light" href="${waLink(settings, lang)}" target="_blank" rel="noopener">${esc(home.cta_secondary)}</a>
    </div>
  </div>
  <div class="quick-card" id="enquire">
    <h2>${esc(home.quick_title)}</h2>
    <p>${esc(home.quick_text)}</p>
    ${leadForm(ctx, 'quick', '/')}
  </div>
</div></section>

<section class="trustbar"><div class="wrap"><ul>${(home.trust || []).map((x) => `<li>${icon(x.icon || 'check')}<div><strong>${esc(x.title)}</strong><span>${esc(x.text)}</span></div></li>`).join('')}</ul></div></section>

<section class="section section-pale"><div class="wrap">
  <div class="section-head-center"><h2 class="section-title">${esc(home.problems_title)}</h2><p class="section-intro">${esc(home.problems_text)}</p></div>
  <div class="solve-grid">${(home.problems || []).map((pr, i) => {
    const sv = svc[pr.service] || {};
    return `<a class="solve-card solve-${i + 1}" href="${href(lang, `/services/${pr.service}/`)}">
      <p class="solve-pain"><span>${esc(t.quick.pain)}</span>${esc(pr.problem)}</p>
      <div class="solve-body">${icon(sv.icon || 'check')}<h3>${esc(sv.title || '')}</h3><p>${esc(pr.outcome)}</p><span class="more">${esc(t.quick.see_service)} ${icon('arrow', 'icon-sm')}</span></div>
    </a>`;
  }).join('')}
    <div class="solve-card solve-start"><h3>${esc(home.start_title)}</h3><p>${esc(home.start_text)}</p><a class="btn btn-accent" href="${href(lang, '/free-hsn-snapshot/')}">${esc(home.cta_primary)}</a></div>
  </div>
</div></section>

<section class="section section-dark proof"><div class="wrap">
  <h2 class="section-title">${esc(home.facts_title)}</h2>
  ${factsStrip(home)}
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head-center"><h2 class="section-title">${esc(home.steps_title)}</h2></div>
  ${journey(home)}
  <p class="center-cta"><a class="btn btn-accent" href="${href(lang, '/free-hsn-snapshot/')}">${esc(home.cta_primary)} ${icon('arrow', 'icon-sm')}</a></p>
</div></section>

<section class="section section-pale"><div class="wrap">
  <div class="audience-row"><h2 class="audience-title">${esc(home.audience_title)}</h2>${(home.audiences || []).map((a) => `<div class="aud">${icon(a.icon || 'check')}<div><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p></div></div>`).join('')}</div>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><div><h2 class="section-title">${esc(home.markets_title)}</h2><p class="section-intro">${esc(home.markets_text)}</p></div><a class="btn btn-outline" href="${href(lang, '/markets/')}">${esc(t.markets_ui.see_all)} ${icon('arrow', 'icon-sm')}</a></div>
  ${marketBoard(ctx, mk, { only: ['zero', 'soon'], compact: true })}
</div></section>

<section class="section section-pale"><div class="wrap faq-grid">
  <div><h2 class="section-title">${esc(home.faq_title)}</h2><p class="section-intro">${esc(t.quick.faq_cta)}</p><a class="btn btn-outline" href="${waLink(settings, lang)}" target="_blank" rel="noopener">${esc(t.common.whatsapp)}</a></div>
  <div class="faq">${(home.faq || []).map((q, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join('')}</div>
</div></section>

${ctaBand(ctx, home.cta_title, home.cta_text)}`;
    const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: (home.faq || []).map((q) => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } })) };
    emit(lang, '/', layout(ctx, { title: home.seo_title, description: home.seo_description, path: '/', body: homeBody, jsonld: [org, website, faqLd] }));

    // Services
    const svcCrumb = crumbs(ctx, [[t.services.title, '/services/']]);
    const servicesBody = `${svcCrumb.html.replace('<nav', '<nav data-pos="top"')}${pageHero('', t.services.title, t.services.intro)}
<section class="section"><div class="wrap"><div class="grid-pillars">${services.map((s, i) => `<a class="pillar pillar-${i + 1}" href="${href(lang, `/services/${s.slug}/`)}">${icon(s.icon)}<h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p><span class="more">${esc(t.common.learn_more)} ${icon('arrow', 'icon-sm')}</span></a>`).join('')}</div></div></section>
${ctaBand(ctx, home.cta_title, home.cta_text)}`;
    emit(lang, '/services/', layout(ctx, { title: t.services.title, description: t.services.intro, path: '/services/', body: servicesBody, jsonld: svcCrumb.ld }));
    for (const s of services) {
      const p = `/services/${s.slug}/`;
      const others = services.filter((x) => x.slug !== s.slug);
      const body = `${pageHero(t.services.title, s.title, s.summary)}
<section class="section"><div class="wrap with-aside">
  <article class="prose">${markdown(s.body)}</article>
  <aside class="side">
    <div class="quick-card quick-side"><h2>${esc(home.quick_title)}</h2><p>${esc(home.quick_text)}</p>${leadForm(ctx, 'quick', p)}</div>
    <nav class="side-card" aria-label="${esc(t.services.title)}"><h2>${esc(t.services.title)}</h2><ul>${others.map((o) => `<li><a href="${href(lang, `/services/${o.slug}/`)}">${esc(o.title)}</a></li>`).join('')}</ul></nav>
  </aside>
</div></section>`;
      const cr = crumbs(ctx, [[t.services.title, '/services/'], [s.title, p]]);
      const svcLd = { '@context': 'https://schema.org', '@type': 'Service', name: s.title, description: s.summary, serviceType: s.title, url: `${site}${href(lang, p)}`, provider: { '@id': orgId }, areaServed: { '@type': 'Country', name: 'India' }, availableLanguage: ['en', 'hi'] };
      emit(lang, p, layout(ctx, { title: s.title, description: s.summary, path: p, body: cr.html + body, alternates: altsFor('service', s.slug), jsonld: [svcLd, cr.ld] }));
    }

    // Markdown pages
    for (const [slug, pg] of Object.entries(pages)) {
      const p = `/${slug}/`;
      const legal = slug === 'privacy' || slug === 'terms';
      const extra = slug === 'markets' ? `<section class="section"><div class="wrap">
  <h2 class="section-title">${esc(mk.board_title)}</h2><p class="section-intro">${esc(mk.board_intro)}</p>
  ${marketBoard(ctx, mk)}
</div></section>
<section class="section section-tint"><div class="wrap"><h2 class="section-title">${esc(mk.timeline_title)}</h2>${timeline(mk)}</div></section>` : '';
      const founderBlock = slug === 'about' && settings.founder_name ? `<section class="section section-pale"><div class="wrap founder">
  ${settings.founder_photo ? `<img src="${esc(settings.founder_photo)}" alt="${esc(settings.founder_name)}" width="160" height="160" loading="lazy">` : `<span class="founder-initial" aria-hidden="true">${esc(settings.founder_name.trim()[0] || 'G')}</span>`}
  <div><p class="eyebrow">${esc(lang === 'hi' ? 'संस्थापक' : 'Founder')}</p><h2>${esc(settings.founder_name)}</h2>${settings.founder_role ? `<p class="founder-role">${esc(settings.founder_role)}</p>` : ''}<p>${esc((lang === 'hi' ? settings.founder_bio_hi : settings.founder_bio_en) || settings.founder_bio_en || '')}</p>${settings.founder_linkedin ? `<a href="${esc(settings.founder_linkedin)}" target="_blank" rel="noopener">LinkedIn</a>` : ''}</div>
</div></section>` : '';
      const pcr = crumbs(ctx, [[pg.title, p]]);
      const body = `${pageHero('', pg.title, pg.description)}
${founderBlock}
${extra}
<section class="section"><div class="wrap"><article class="prose prose-wide">${markdown(pg.body)}</article></div></section>
${legal ? '' : ctaBand(ctx, home.cta_title, home.cta_text)}`;
      emit(lang, p, layout(ctx, { title: pg.title, description: pg.description || excerpt(pg.body), path: p, body: pcr.html + body, alternates: altsFor('page', slug), jsonld: legal ? pcr.ld : [pcr.ld, ...(slug === 'about' ? [{ '@context': 'https://schema.org', '@type': 'AboutPage', name: pg.title, url: `${site}${href(lang, p)}`, about: { '@id': orgId } }] : [])] }));
    }

    // Insights
    const listBody = `${pageHero('', t.insights.title, t.insights.intro)}
<section class="section"><div class="wrap"><div class="grid-3">${posts.map((p) => postCard(ctx, p)).join('')}</div></div></section>`;
    emit(lang, '/insights/', layout(ctx, { title: t.insights.title, description: t.insights.intro, path: '/insights/', body: listBody }));
    for (const post of posts) {
      const p = `/insights/${post.slug}/`;
      const ld = {
        '@context': 'https://schema.org', '@type': 'Article', headline: post.title, description: post.description,
        datePublished: post.dateObj?.toISOString(), dateModified: (asDate(post.updated) || post.dateObj)?.toISOString(), inLanguage: lang === 'hi' ? 'hi-IN' : 'en-IN',
        author: founder ? { ...founder, worksFor: { '@id': orgId } } : { '@id': orgId }, publisher: { '@id': orgId }, image: post.image ? `${site}${post.image}` : `${site}/images/og-default.png`, keywords: (post.tags || []).join(', ') || undefined,
        mainEntityOfPage: `${site}${href(lang, p)}`,
      };
      const body = `<section class="page-hero"><div class="wrap">
  <p class="eyebrow"><a href="${href(lang, '/insights/')}">${esc(t.insights.title)}</a></p>
  <h1>${esc(post.title)}</h1>
  <p class="meta">${esc(t.common.published)} <time datetime="${esc(post.dateObj?.toISOString().slice(0, 10) || '')}">${esc(ctx.fmtDate(post.date))}</time>${post.updated && String(post.updated) !== String(post.date) ? ` · ${esc(t.common.updated)} <time datetime="${esc(String(post.updated))}">${esc(ctx.fmtDate(post.updated))}</time>` : ''}${post.tags?.length ? ` · ${esc(post.tags.join(', '))}` : ''}</p>
</div></section>
<section class="section"><div class="wrap"><article class="prose prose-wide">
  ${post.image ? `<img class="post-image" src="${esc(post.image)}" alt="" loading="lazy">` : ''}
  ${markdown(post.body)}
</article></div></section>
${ctaBand(ctx, home.cta_title, home.cta_text)}`;
      const bcr = crumbs(ctx, [[t.insights.title, '/insights/'], [post.title, p]]);
      emit(lang, p, layout(ctx, { title: post.title, description: post.description || excerpt(post.body), path: p, body: bcr.html + body, alternates: altsFor('post', post.slug), jsonld: [ld, bcr.ld], ogType: 'article' }));
    }

    // Contact
    const contactBody = `${pageHero('', t.contact.title, t.contact.intro)}
<section class="section"><div class="wrap with-aside">
  <div class="form-card">${leadForm(ctx, 'contact', '/contact/')}</div>
  <aside class="side">
    <div class="side-card"><h2>${esc(t.contact.direct)}</h2>
      <p>${icon('mail', 'icon-sm')} <a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a></p>
      <p>${icon('phone', 'icon-sm')} <a href="tel:${esc(String(settings.phone).replace(/[^\d+]/g, ''))}">${esc(settings.phone)}</a></p>
      ${settings.address ? `<p>${esc(settings.address)}</p>` : ''}
      <a class="btn btn-outline" href="${waLink(settings, lang)}" target="_blank" rel="noopener">${esc(t.common.whatsapp)}</a>
    </div>
  </aside>
</div></section>`;
    emit(lang, '/contact/', layout(ctx, { title: t.contact.title, description: t.contact.intro, path: '/contact/', body: contactBody }));

    // Free HSN snapshot
    const snapBody = `${pageHero(t.nav.cta, t.snapshot.title, t.snapshot.intro)}
<section class="section"><div class="wrap with-aside aside-left">
  <aside class="side"><div class="side-card side-dark"><ul class="ticks">${t.snapshot.points.map((x) => `<li>${icon('check')} ${esc(x)}</li>`).join('')}</ul></div></aside>
  <div class="form-card">${leadForm(ctx, 'snapshot', '/free-hsn-snapshot/')}</div>
</div></section>`;
    emit(lang, '/free-hsn-snapshot/', layout(ctx, { title: t.snapshot.title, description: t.snapshot.intro, path: '/free-hsn-snapshot/', body: snapBody }));

    // Thank you (not indexed)
    const thanksBody = `<section class="page-hero page-hero-center"><div class="wrap narrow">
  ${icon('check', 'icon-xl')}
  <h1>${esc(t.thanks.title)}</h1>
  <p class="lead">${esc(t.thanks.text)}</p>
  <div class="hero-actions center"><a class="btn btn-accent" href="${waLink(settings, lang)}" target="_blank" rel="noopener">${esc(t.common.whatsapp)}</a><a class="btn btn-ghost-light" href="${href(lang, '/')}">${esc(t.thanks.home)}</a></div>
</div></section>`;
    emit(lang, '/thank-you/', layout(ctx, { title: t.thanks.title, description: t.thanks.text, path: '/thank-you/', body: thanksBody, noindex: true }), LOCALES, false);

    // 404
    const nfBody = `<section class="page-hero page-hero-center"><div class="wrap narrow"><h1>${esc(t.common.not_found_title)}</h1><p class="lead">${esc(t.common.not_found_text)}</p><div class="hero-actions center"><a class="btn btn-accent" href="${href(lang, '/')}">${esc(t.common.go_home)}</a></div></div></section>`;
    emit(lang, '404.html', layout(ctx, { title: t.common.not_found_title, description: t.common.not_found_text, path: '/404.html', body: nfBody, noindex: true }), LOCALES, false);
  }

  // sitemap.xml with hreflang alternates, and robots.txt
  const urls = sitemap.map((e) => `<url><loc>${site}${href(e.lang, e.path)}</loc>${e.alternates.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${site}${href(l, e.path)}"/>`).join('')}</url>`);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /thank-you/\nDisallow: /hi/thank-you/\n\nSitemap: ${site}/sitemap.xml\n`);
  write('llms.txt', llmsTxt(settings, content, site));
  return { pages: sitemap.length, out: OUT };
}

// llms.txt: a plain-language summary of the business for AI assistants.
function llmsTxt(settings, content, site) {
  const { home, services, posts, mk } = content.en;
  const zero = mk.markets.filter((m) => m.status === 'zero').map((m) => `${m.name} (${m.note})`);
  return `# ${settings.site_name}

> ${settings.site_name}${settings.business_name ? ` (also known as ${settings.business_name})` : ''}, at ${site.replace('https://', '')}, is an export consultancy for Indian manufacturers, artisans and exporters. It is backed by ${settings.backed_by}, an Indian exporter since ${settings.since}. ${settings.site_name} handles market research by HSN code, export licences and compliance, freight, payments and government export benefits such as RoDTEP, in English and Hindi.

## Services
${services.map((x) => `- [${x.title}](${site}/services/${x.slug}/): ${x.summary}`).join('\n')}

## Free offer
- [Free HSN export snapshot](${site}/free-hsn-snapshot/): a two-page report for a product's HSN code covering top importing countries, the duty Indian goods pay there, and export schemes the exporter may claim.

## Who it serves
${(home.audiences || []).map((a) => `- ${a.title}: ${a.text}`).join('\n')}

## Products of focus
Handicrafts, home textiles, carpets and rugs, and apparel; other products are assessed by HSN code.

## Pricing
The HSN snapshot is free. Services are quoted per scope. Under the Export Sales Partner model, clients pay a monthly retainer plus 5–10% commission on export payments actually received. ${settings.site_name} does not guarantee orders or payments.

## Markets where Indian goods currently enter duty-free (as of October 2026)
${zero.map((z) => `- ${z}`).join('\n')}

## Key pages
- [Markets](${site}/markets/)
- [Government export schemes](${site}/schemes/)
- [About](${site}/about/)
- [Export insights](${site}/insights/)
${posts.map((p) => `  - [${p.title}](${site}/insights/${p.slug}/)`).join('\n')}
- Hindi version: ${site}/hi/

## Contact
- Phone and WhatsApp: ${settings.phone}
- Email: ${settings.email}
${settings.google_business_url ? `- Google Business Profile: ${settings.google_business_url}\n` : ''}- [Contact form](${site}/contact/)
`;
}

const result = build();
console.log(`Built ${result.pages} indexable pages into ${path.relative(process.cwd(), result.out) || result.out}`);
