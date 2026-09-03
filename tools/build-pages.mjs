/**
 * build-pages.mjs — give every poem a real address.
 *
 *   node tools/build-pages.mjs
 *
 * The site is one document with three views and a hash for an address, which
 * reads well and indexes badly: a search engine treats #une-charogne as the
 * same page as #le-vampire, so 133 poems compete for one result. This writes
 * each of them out as a page of its own —
 *
 *     poems/une-charogne/index.html
 *     about/index.html
 *     sitemap.xml
 *     robots.txt
 *
 * — built from index.html itself, so there is no second copy of the markup to
 * keep in step. Each page carries its own title, description, canonical URL,
 * link-preview card and schema.org graph (all of them from meta.js, which
 * translation.js also uses, so the page says the same thing to a crawler as it
 * does to a reader), and it carries the poem already rendered into the HTML.
 * That last part is what a crawler without JavaScript sees, and what paints
 * before a megabyte of poem data has finished arriving; translation.js
 * replaces it with the interactive grid as soon as it runs.
 *
 * Every generated page is still the whole site — the same sidebar, the same
 * search, the same reader — so landing on one from a search result and landing
 * on it from the sidebar are the same thing. Navigation between them is a
 * pushState where the browser allows it and a plain page load otherwise, which
 * is what keeps the site working opened straight off disk.
 *
 * Re-run it after adding a poem, or after changing the head of index.html.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_POEMS = join(ROOT, 'poems');
const OUT_ABOUT = join(ROOT, 'about');

/* --- the corpus, loaded the way the browser loads it ---------------------- */

/* Only the numbered section directories hold poems. `inSection` keeps the .js
   files at the root out of it — running search.js or edit.js here would do
   nothing but throw on the missing document, and en-syllables.js is 130 KB of
   irrelevance. */
function poemFiles(dir, inSection) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (/^\d+\. /.test(name)) out.push(...poemFiles(p, true));
    } else if (inSection && name.endsWith('.js')) out.push(p);
  }
  return out;
}

/* Poem files self-register into window.POEMS; translation-data.js then decides
   the order, and bravo.js folds the site's own translations onto the segments.
   meta.js rides along so the strings come from the same place the page uses. */
function loadSite() {
  const ctx = vm.createContext({ window: { POEMS: {} } });
  const run = (file) => vm.runInContext(readFileSync(file, 'utf8'), ctx, { filename: file });
  for (const f of poemFiles(ROOT)) {
    try { run(f); } catch { /* not a poem file */ }
  }
  run(join(ROOT, 'translation-data.js'));
  run(join(ROOT, 'bravo.js'));
  run(join(ROOT, 'meta.js'));
  return ctx.window;
}

/* --- reading the template ------------------------------------------------- */

/* U+FEFF is stripped for the same reason translation.js strips it: a few lines
   of the corpus carry one, and it would otherwise sit in the indexed text. */
const esc = (s) => String(s)
  .replace(/﻿/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* Which part of the book each poem belongs to. Both halves are already written
   down — the id-to-slug map in translation.js, the slug-to-name in the sidebar
   markup — so read them rather than keep a third copy here. */
function sectionNames(template) {
  const names = {};
  const re = /data-section-toggle="([^"]+)"[\s\S]*?<span class="sidebar-section-name">([^<]+)<\/span>/g;
  for (const m of template.matchAll(re)) names[m[1]] = m[2].trim();
  return names;
}

function poemSections() {
  const src = readFileSync(join(ROOT, 'translation.js'), 'utf8');
  const block = src.match(/var POEM_SECTIONS = \{([\s\S]*?)\n  \};/);
  if (!block) throw new Error('POEM_SECTIONS not found in translation.js');
  const map = {};
  for (const m of block[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) map[m[1]] = m[2];
  return map;
}

/* --- rendering a poem into the grid --------------------------------------- */

const COLUMN_TITLES = {
  fr: 'Français',
  en: 'English (Scott)',
  es: 'Español (Marquina)',
  'en-bravo': 'English (Bravo)',
  'es-bravo': 'Español (Bravo)'
};

const showLineNumber = (i) => i + 1 === 1 || (i + 1) % 5 === 0;

function hasLang(poem, lang) {
  return (poem.segments || []).some((seg) => seg[lang]);
}

/* Which translation the page opens in. translation.js makes the same choice —
   the reader's language if the poem has it, otherwise one it does have, since
   a "no translation yet" note is a poor thing for a page to be about. */
function primaryLang(poem) {
  for (const lang of ['en', 'es', 'en-bravo', 'es-bravo']) {
    if (hasLang(poem, lang)) return lang;
  }
  return 'en';  /* nothing to show; the column carries the note instead */
}

function missingHtml(lang) {
  return '<div class="translation-missing">' +
    `<p class="translation-missing-title">No ${esc(COLUMN_TITLES[lang] || lang)} translation yet</p>` +
    '<p class="translation-missing-note"></p></div>';
}

/* The blocks of one column, mirroring renderPoem() in translation.js. Word
   groups are left out: they only carry hover, and the text is the same
   without them. */
function columnBlocks(poem, lang) {
  const segments = poem.segments || [];
  const blocks = poem.blocks?.length ? poem.blocks : [{ type: 'stanza', lines: segments.length }];
  const out = [];
  let i = 0;
  for (const b of blocks) {
    if (b.type === 'blank') { out.push({ type: 'blank' }); continue; }
    if (b.type === 'part') { out.push({ type: 'part', label: b.label || '' }); continue; }
    if (b.type !== 'stanza') continue;
    const take = b.lines || 4;
    const stanza = segments.slice(i, i + take);
    i += take;
    if (!stanza.length) continue;
    out.push({ type: 'stanza', lines: stanza });
  }
  return out;
}

function stanzaHtml(lines, lang) {
  const parts = [];
  for (const seg of lines) {
    const text = seg[lang];
    if (text == null) continue;
    const inner = `<span class="translation-segment" data-tid="${seg.id}">${esc(text)}</span>`;
    if (lang === 'fr') {
      const n = showLineNumber(seg.id) ? String(seg.id + 1) : '';
      parts.push(`<div class="line"><span class="line-number" aria-hidden="true">${n}</span>${inner}</div>`);
    } else {
      parts.push(inner);
    }
  }
  return lang === 'fr' ? parts.join('\n        ') : parts.join('<br>\n        ');
}

function sourceHtml(poem, lang) {
  const src = poem.sources || {};
  const text = lang === 'fr' ? src.fr : src[lang];
  if (!text) return '';
  const url = lang === 'fr' ? src.frUrl : src[`${lang}Url`];
  const label = lang === 'fr' ? 'Source' : 'Translation';
  const body = url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`
    : esc(text);
  return `<div class="column-source"><span class="column-source-label">${label}</span>` +
    `<span class="column-source-text">${body}</span></div>`;
}

/**
 * The comparison grid as static HTML, in the shape buildComparison() produces
 * so that the stylesheet lays it out identically and nothing shifts when the
 * script takes over.
 */
function comparisonHtml(poem, lang) {
  const cols = ['fr', lang].filter(Boolean);
  const fr = columnBlocks(poem, 'fr');
  const numRows = fr.length + 2;                 /* header + blocks + sources */
  const rows = [];
  const missing = !hasLang(poem, lang);
  let firstStanza = true;

  const cell = (col, row, html, extra) => {
    const classes = ['cell', `cell-${cols[col]}`];
    if (extra) classes.push(extra);
    if (col === 1) classes.push('cell-translation');
    if (row === 1) classes.push('row-first');
    if (row === numRows) classes.push('row-last');
    classes.push(col === 0 ? 'column-left' : 'column-right');
    return `<div class="${classes.join(' ')}" data-lang="${cols[col]}" role="cell" ` +
      `style="grid-row: ${row}; grid-column: ${col + 1};">${html}</div>`;
  };

  /* Row 1 — the column headings. The dropdown trigger is left to the script;
     until then the name of the translation is simply text. */
  rows.push(cell(0, 1, `<h2 class="column-title" id="column-title-fr">${COLUMN_TITLES.fr}</h2>`));
  if (cols[1]) {
    const name = (poem.titles && poem.titles[cols[1]]) || poem.title;
    rows.push(cell(1, 1, `<div class="column-title column-title--translation">` +
      `<span class="column-title-text">${esc(name)}</span></div>`));
  }

  fr.forEach((block, i) => {
    const row = i + 2;
    if (block.type === 'blank') {
      cols.forEach((_, c) => rows.push(cell(c, row,
        '<div class="stanza-blank" aria-hidden="true"></div>', 'cell-blank')));
      return;
    }
    if (block.type === 'part') {
      cols.forEach((_, c) => rows.push(cell(c, row,
        `<div class="stanza-part">${esc(block.label)}</div>`, 'cell-part')));
      return;
    }
    cols.forEach((code, c) => {
      const numbered = code === 'fr' ? ' stanza--numbered' : '';
      if (c === 1 && missing) {
        /* One cell per block, so the two columns still have the same number of
           rows; the note rides on the first stanza and the rest stay empty. */
        const note = firstStanza ? missingHtml(code) : '';
        firstStanza = false;
        rows.push(cell(c, row, `<div class="stanza stanza--missing">${note}</div>`));
        return;
      }
      rows.push(cell(c, row, `<div class="stanza${numbered}">${stanzaHtml(block.lines, code)}</div>`));
    });
  });

  cols.forEach((code, c) => rows.push(cell(c, numRows, sourceHtml(poem, code), 'cell-source')));
  return rows.join('\n      ');
}

/* The sidebar, pre-filled. buildSidebar() empties and rebuilds these lists, so
   this is purely what a crawler follows and what a reader sees before the
   script runs — but it is the whole index of the site, on every page. */
function sidebarHtml(win, sections, prefix) {
  const lists = {};
  for (const id of win.POEM_IDS) {
    const slug = sections[id] || 'spleen-et-ideal';
    (lists[slug] ||= []).push(
      `<li><a href="${prefix}poems/${id}/" data-poem-id="${id}">${esc(win.POEMS[id].title)}</a></li>`
    );
  }
  return lists;
}

/* Write the poem links into the empty <ul>s the template carries. Idempotent:
   it replaces whatever is between the tags, so re-running is safe. */
function fillSidebar(html, lists) {
  return html.replace(
    /(<ul class="poem-list" role="list" id="poem-list-([^"]+)" data-section="[^"]+">)[\s\S]*?(<\/ul>)/g,
    (whole, open, slug, close) => {
      const items = (lists[slug] || []).map((li) => `          ${li}`).join('\n');
      return `${open}\n${items}\n        ${close}`;
    }
  );
}

/* --- assembling a page ---------------------------------------------------- */

/* Re-point every relative link and script for a page `depth` directories below
   the root. Anything absolute, external or a fragment is left alone. */
function rebase(html, prefix) {
  if (!prefix) return html;
  return html.replace(/\b(src|href)="([^"]*)"/g, (whole, attr, value) => {
    if (/^(?:[a-z]+:|\/\/|\/|#)/i.test(value)) return whole;
    const clean = value.replace(/^\.\//, '');
    return `${attr}="${prefix}${clean}"`;
  });
}

function replaceOnce(html, pattern, replacement, what) {
  const matches = html.match(pattern);
  if (!matches) throw new Error(`build-pages: could not find ${what} in index.html`);
  return html.replace(pattern, () => replacement);
}

function setHead(html, { title, description, url, type, jsonLd }) {
  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`, '<title>');
  html = replaceOnce(html, /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${esc(description)}">`, 'description');
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${esc(url)}">`, 'canonical');
  html = replaceOnce(html, /<meta property="og:type" content="[^"]*">/,
    `<meta property="og:type" content="${type}">`, 'og:type');
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${esc(title)}">`, 'og:title');
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${esc(description)}">`, 'og:description');
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${esc(url)}">`, 'og:url');
  html = replaceOnce(html, /<meta name="twitter:title" content="[^"]*">/,
    `<meta name="twitter:title" content="${esc(title)}">`, 'twitter:title');
  html = replaceOnce(html, /<meta name="twitter:description" content="[^"]*">/,
    `<meta name="twitter:description" content="${esc(description)}">`, 'twitter:description');
  if (jsonLd) {
    html = replaceOnce(html, /<script type="application\/ld\+json" id="ld-json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json" id="ld-json">\n${JSON.stringify(jsonLd, null, 2)}\n  </script>`,
      'ld-json');
  }
  return html;
}

function buildPage(template, win, sections, opts) {
  const prefix = opts.prefix;
  let html = rebase(template, prefix);

  html = html.replace('<html lang="en" data-base="">', `<html lang="en" data-base="${prefix}">`);
  html = html.replace('<body data-view="poem">', `<body data-view="${opts.view}">`);

  html = fillSidebar(html, sidebarHtml(win, sections, prefix));
  html = setHead(html, opts.head);

  if (opts.view === 'poem') {
    const poem = win.POEMS[opts.id];
    html = replaceOnce(html, /<h1 class="title">[^<]*<\/h1>/,
      `<h1 class="title">${esc(poem.title)}</h1>`, 'poem <h1>');
    html = replaceOnce(html, /<span class="topbar-title">[^<]*<\/span>/,
      `<span class="topbar-title">${esc(poem.title)}</span>`, 'topbar title');
    const open = html.match(/<main class="comparison"[^>]*>/);
    if (!open) throw new Error('build-pages: <main class="comparison"> not found');
    html = replaceOnce(html, /<main class="comparison"[^>]*>[\s\S]*?<\/main>/,
      `${open[0]}\n      ${comparisonHtml(poem, primaryLang(poem))}\n      </main>`, '.comparison');

    /* Prev and next, so the whole book is walkable without a script. */
    const order = win.POEM_IDS;
    const i = order.indexOf(opts.id);
    const link = (cls, otherId, inner) => {
      const poemThere = otherId ? win.POEMS[otherId] : null;
      const attrs = poemThere
        ? ` href="${prefix}poems/${otherId}/"`
        : ' aria-disabled="true"';
      return `<a class="poem-nav-btn ${cls}" aria-label="${cls.endsWith('prev') ? 'Previous' : 'Next'} poem"${attrs}>${inner(poemThere ? poemThere.title : '')}</a>`;
    };
    html = replaceOnce(html, /<a class="poem-nav-btn poem-nav-prev"[\s\S]*?<\/a>/,
      link('poem-nav-prev', i > 0 ? order[i - 1] : null,
        (t) => `<span class="poem-nav-label">Previous</span> <cite class="poem-nav-title">${esc(t)}</cite>`),
      'prev link');
    html = replaceOnce(html, /<a class="poem-nav-btn poem-nav-next"[\s\S]*?<\/a>/,
      link('poem-nav-next', i >= 0 && i < order.length - 1 ? order[i + 1] : null,
        (t) => `<cite class="poem-nav-title">${esc(t)}</cite> <span class="poem-nav-label">Next</span>`),
      'next link');
  }

  return html;
}

/* --- sitemap and robots --------------------------------------------------- */

function sitemap(win) {
  const SITE = win.META.SITE_URL;
  const urls = [
    { loc: `${SITE}/`, priority: '1.0' },
    { loc: `${SITE}/about/`, priority: '0.3' },
    ...win.POEM_IDS.map((id) => ({ loc: win.META.poemUrl(id), priority: '0.8' }))
  ];
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>monthly</changefreq>\n` +
      `    <priority>${u.priority}</priority>\n  </url>`).join('\n') +
    '\n</urlset>\n';
}

function robots(win) {
  return [
    '# Everything here is public: 133 poems, each at its own address.',
    'User-agent: *',
    'Allow: /',
    '',
    '# Authoring tool, localhost only — it is never deployed, but say so anyway.',
    'Disallow: /api/',
    '',
    `Sitemap: ${win.META.SITE_URL}/sitemap.xml`,
    ''
  ].join('\n');
}

/* --- go ------------------------------------------------------------------- */

const win = loadSite();
const template = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sections = poemSections();
const sectionLabels = sectionNames(template);
const META = win.META;

/* Start clean, so a renamed or removed poem does not leave a page behind. */
for (const dir of [OUT_POEMS, OUT_ABOUT]) rmSync(dir, { recursive: true, force: true });

let written = 0;
for (const id of win.POEM_IDS) {
  const poem = win.POEMS[id];
  const codes = META.translationCodes(id, win.POEMS, win.BRAVO);
  const langs = META.translationLangsOf(codes);
  const dir = join(OUT_POEMS, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), buildPage(template, win, sections, {
    view: 'poem',
    id,
    prefix: '../../',
    head: {
      title: META.poemTitle(poem, langs),
      description: META.poemDescription(poem, langs),
      url: META.poemUrl(id),
      type: 'article',
      jsonLd: META.poemJsonLd({ id, poem, codes, section: sectionLabels[sections[id]] || '' })
    }
  }), 'utf8');
  written += 1;
}

mkdirSync(OUT_ABOUT, { recursive: true });
writeFileSync(join(OUT_ABOUT, 'index.html'), buildPage(template, win, sections, {
  view: 'about',
  prefix: '../',
  head: {
    title: META.ABOUT_TITLE,
    description: META.ABOUT_DESCRIPTION,
    url: META.absoluteUrl('about/'),
    type: 'website'
  }
}), 'utf8');

/* The root page keeps its own head — it is the template — but its sidebar is
   filled in here too, so a crawler landing on / finds all 133 poems without
   running a line of JavaScript. */
writeFileSync(join(ROOT, 'index.html'),
  fillSidebar(template, sidebarHtml(win, sections, '')), 'utf8');

writeFileSync(join(ROOT, 'sitemap.xml'), sitemap(win), 'utf8');
writeFileSync(join(ROOT, 'robots.txt'), robots(win), 'utf8');

/* primaryLang() falls back to 'en' so the column can carry the note, so count
   from the poem's own data rather than from it. */
const counts = { en: 0, es: 0, any: 0 };
for (const id of win.POEM_IDS) {
  const codes = META.translationCodes(id, win.POEMS, win.BRAVO);
  if (codes.some((c) => c.startsWith('en'))) counts.en += 1;
  if (codes.some((c) => c.startsWith('es'))) counts.es += 1;
  if (codes.length) counts.any += 1;
}

console.log(`poems/       ${written} pages`);
console.log(`about/       1 page`);
console.log(`sitemap.xml  ${written + 2} urls`);
console.log(`robots.txt   written`);
console.log(`
${counts.any} of ${written} poems show a translation beside the French (${counts.en} English, ${counts.es} Spanish).`);
console.log(`${written - counts.any} carry the French alone.`);
