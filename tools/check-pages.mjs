/**
 * check-pages.mjs — does a generated page still have a whole site in it?
 *
 *   node tools/check-pages.mjs
 *
 * A page used to carry the entire corpus: every poem in a script tag of its
 * own, the full 133-link sidebar in its markup, and both written pages. It now
 * carries the one poem it is about and builds the rest from poems.js, which is
 * a great deal less to serve and several more ways to be wrong. This checks the
 * ones that would be silent:
 *
 *   - a page names its own poem and no others;
 *   - the manifest points at a file that really does register that poem;
 *   - POEM_IDS is still the whole book on a page that has loaded one poem of it
 *     (it is built by filtering the authored order, and filtering against
 *     window.POEMS rather than the manifest would leave it holding one entry);
 *   - corpus.js can fetch the rest, and bravo.js's translations survive the
 *     trip — a poem arriving after the page has parsed misses the pass bravo.js
 *     makes over the corpus, so corpus.js has to fold it itself;
 *   - the markup a crawler reads is on the page that should have it and off the
 *     ones that should not.
 *
 * The scripts run under node:vm the way tools/build-pages.mjs runs the poem
 * files, against enough of a DOM for the four that have no UI in them. The
 * shim's appendChild really does load the file, so corpus.js is exercised
 * rather than imitated. translation.js and search.js need a browser and are
 * not run here.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
function check(ok, what, detail) {
  if (ok) { console.log(`  ok   ${what}`); return; }
  failures += 1;
  console.log(`  FAIL ${what}${detail ? ` — ${detail}` : ''}`);
}

/* --- a page, loaded the way a browser loads it ---------------------------- */

/* The scripts a page names, in order. Only the deferred ones: the two inline
   guards at the top of the body pick a view and fetch edit mode, and neither
   has anything to do with the poems. */
function scriptsOf(html) {
  return [...html.matchAll(/<script defer src="([^"]+)"><\/script>/g)].map((m) => m[1]);
}

/**
 * Enough DOM for poems.js, a poem file, translation-data.js, bravo.js and
 * corpus.js. `appendChild` on a script element resolves the src against the
 * page's own directory and runs the file, which is what lets corpus.js be
 * tested rather than described.
 */
function loadPage(pageDir, html, { base }) {
  const win = { POEMS: {} };
  const listeners = {};

  const head = {
    appendChild(el) {
      if (!el || el.tagName !== 'SCRIPT') return el;
      const file = resolve(pageDir, decodeURIComponent(el.src));
      if (!existsSync(file)) {
        if (el.onerror) el.onerror();
        return el;
      }
      run(file);
      if (el.onload) el.onload();
      return el;
    }
  };

  const doc = {
    readyState: 'loading',   /* so corpus.js waits to be asked, and prefetch()
                                does not race the assertions */
    documentElement: {
      getAttribute: (name) => (name === 'data-base' ? base : null)
    },
    head,
    createElement: (tag) => ({ tagName: tag.toUpperCase(), src: '', onload: null, onerror: null }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  };

  Object.assign(win, {
    document: doc,
    location: { protocol: 'http:', pathname: '/', hash: '', href: 'http://localhost/' },
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    setTimeout: (fn) => { fn(); return 0; },
    Promise,
    Error
  });

  const ctx = vm.createContext(win);
  ctx.window = win;
  ctx.document = doc;

  function run(file) {
    vm.runInContext(readFileSync(file, 'utf8'), ctx, { filename: file });
  }

  for (const src of scriptsOf(html)) {
    const file = resolve(pageDir, decodeURIComponent(src));
    /* translation.js and search.js want a browser; the data layer does not. */
    if (/(?:translation|search|meta|site-lang)\.js$/.test(src) && !src.endsWith('translation-data.js')) continue;
    if (!existsSync(file)) { check(false, `script exists: ${src}`); continue; }
    run(file);
  }

  return win;
}

/* --- go ------------------------------------------------------------------- */

const rootHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
const poemId = 'une-charogne';
const poemDir = join(ROOT, 'poems', poemId);
const poemHtml = readFileSync(join(poemDir, 'index.html'), 'utf8');
const aboutHtml = readFileSync(join(ROOT, 'about', 'index.html'), 'utf8');

console.log(`\nA poem page — poems/${poemId}/`);

const poemScripts = scriptsOf(poemHtml).filter((s) => /(?:^|\/)\d+\. /.test(s));
check(poemScripts.length === 1 && poemScripts[0].endsWith(`/${poemId}.js`),
  'names its own poem, and no others', `named ${poemScripts.length}: ${poemScripts.join(', ')}`);
check(!/data-poem-id/.test(poemHtml), 'carries no copy of the 133-link sidebar');
check(!/id="view-home"/.test(poemHtml) && !/id="view-about"/.test(poemHtml),
  'carries neither written page');
check(/class="translation-segment"/.test(poemHtml),
  'carries the verse itself, for a crawler that runs nothing');
check(/<link rel="canonical" href="https:\/\/floresdelmal\.org\/poems\/une-charogne\/">/.test(poemHtml),
  'says which page it is');

const page = loadPage(poemDir, poemHtml, { base: '../../' });

check(Object.keys(page.POEM_INDEX || {}).length === 133,
  'the manifest lists the whole book', `${Object.keys(page.POEM_INDEX || {}).length} entries`);
check(Object.keys(page.POEMS).length === 1,
  'only the page\'s own poem has been loaded', `${Object.keys(page.POEMS).length} loaded`);
check(page.POEM_IDS && page.POEM_IDS.length === 133,
  'POEM_IDS is still the whole book, not just what is loaded',
  `${(page.POEM_IDS || []).length} ids`);
check(page.CURRENT_POEM_ID === poemId, 'opens on its own poem', page.CURRENT_POEM_ID);
check((page.TRANSLATION_SEGMENTS || []).length > 0, 'has verse to render');

/* Every entry in the manifest points at a file that registers that poem. A
   wrong path here is a poem that silently never loads. */
let badSrc = [];
for (const [id, entry] of Object.entries(page.POEM_INDEX)) {
  if (!entry.src || !existsSync(join(ROOT, entry.src))) badSrc.push(id);
}
check(badSrc.length === 0, 'every manifest entry points at a file that exists',
  badSrc.slice(0, 5).join(', '));

console.log('\ncorpus.js, fetching the rest');

check(!!page.CORPUS, 'corpus.js is loaded and exposed');
check(page.CORPUS.has(poemId) && !page.CORPUS.has('le-voyage'),
  'knows what has arrived and what has not');

await page.CORPUS.ensure('le-voyage');
check(page.CORPUS.has('le-voyage'), 'ensure() fetches one poem on demand');
check((page.POEMS['le-voyage'].segments || []).length > 0, 'and it comes with its verse');

await page.CORPUS.ensureAll();
const loaded = page.POEM_IDS.filter((id) => page.CORPUS.has(id));
check(loaded.length === 133, 'ensureAll() fetches the whole book',
  `${loaded.length} of ${page.POEM_IDS.length}`);
check(page.CORPUS.isReady(), 'and says so afterwards');

/* bravo.js runs its one pass over whatever was loaded at parse time, so a poem
   arriving later is folded by corpus.js instead. If that ever stops happening,
   the site's own translations quietly vanish from every poem but the one the
   page was about — which nothing else here would catch. */
const bravoPoem = page.POEM_IDS.find((id) =>
  id !== poemId && page.BRAVO.langsFor(id).length > 0);
if (bravoPoem) {
  const lang = page.BRAVO.langsFor(bravoPoem)[0];
  const folded = (page.POEMS[bravoPoem].segments || []).some((seg) => seg[lang]);
  check(folded, `a Bravo translation loaded late is folded onto its segments (${bravoPoem}, ${lang})`);
} else {
  check(false, 'found no finished Bravo translation to check folding against');
}

console.log('\nThe root page — /');

check((rootHtml.match(/data-poem-id/g) || []).length === 133,
  'carries all 133 links, so a crawler has an index to follow');
check(/id="view-home"/.test(rootHtml) && /id="view-about"/.test(rootHtml),
  'carries both written pages');
check(/<!--POEM-SCRIPT-->/.test(rootHtml) && /<!--\/POEM-SCRIPT-->/.test(rootHtml),
  'still has the markers, so it is still a template');
check(scriptsOf(rootHtml).filter((s) => /^\d+\. /.test(s)).length === 1,
  'names one poem — the one its extract quotes');

console.log('\nThe about page — /about/');

check(/id="view-about"/.test(aboutHtml), 'carries the written pages');
check(scriptsOf(aboutHtml).filter((s) => /^(?:\.\.\/)*\d+\. /.test(s)).length === 0,
  'loads no poem at all, having no verse on it');
check(!/data-poem-id/.test(aboutHtml), 'carries no copy of the sidebar');

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
