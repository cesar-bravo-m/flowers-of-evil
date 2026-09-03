/**
 * check-meter.mjs — score syllables.js against the whole corpus.
 *
 * Baudelaire's metre is strict: within a poem the lines agree with each other,
 * so where our count disagrees with the poem it is almost always the counter
 * that is wrong. That makes 3,576 French lines a free test set, and this is how
 * the rules in syllables.js were tuned rather than guessed at.
 *
 * The same trick works on the two public-domain translations, which are also in
 * verse: Cyril Scott (en, 50 poems) and Eduardo Marquina (es, 114 poems).
 *
 *   node tools/check-meter.mjs                    French, the summary
 *   node tools/check-meter.mjs --lang es          Marquina
 *   node tools/check-meter.mjs --outliers 40      show the worst offenders
 *   node tools/check-meter.mjs --poem au-lecteur --verbose
 *
 * Expected metre is inferred, never declared: lines are bucketed by their
 * stanza's length and their position in it, and each bucket takes the count
 * most of its lines agree on. That covers isometric poems and the regular
 * alternations (12/12/12/8, or L'Invitation au voyage's 5/5/7) alike.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* franciscae-meae-laudes is written in Latin, not French; it has no business in
   a French metre score. */
const SKIP_FR = new Set(['franciscae-meae-laudes']);

function parseArgs(argv) {
  const opt = { lang: 'fr', poem: null, verbose: false, outliers: 25 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lang') opt.lang = argv[++i];
    else if (a === '--poem') opt.poem = argv[++i];
    else if (a === '--verbose' || a === '-v') opt.verbose = true;
    else if (a === '--outliers') opt.outliers = Number(argv[++i]);
    else if (a === '--all') opt.outliers = Infinity;
  }
  return opt;
}

function poemFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (/^\d+\. /.test(name)) out.push(...poemFiles(p));
    } else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

/* Poem files self-register into window.POEMS, exactly as they do in the page. */
function loadCorpus() {
  const ctx = vm.createContext({ window: { POEMS: {} } });
  for (const f of poemFiles(ROOT)) {
    try { vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f }); } catch { /* not a poem file */ }
  }
  return ctx.window.POEMS;
}

/* Which stanza is each line in, how long is it, and where does it sit? */
function positions(poem) {
  const segs = poem.segments || [];
  const blocks = poem.blocks?.length ? poem.blocks : [{ type: 'stanza', lines: segs.length }];
  const out = [];
  let i = 0;
  for (const b of blocks) {
    if (b.type !== 'stanza') continue;
    const take = b.lines || segs.length;
    for (let n = 0; n < take && i < segs.length; n++, i++) out.push({ len: take, pos: n });
  }
  while (i < segs.length) out.push({ len: 0, pos: 0 }), i++;
  return out;
}

function modal(counts) {
  const tally = new Map();
  for (const c of counts) tally.set(c, (tally.get(c) || 0) + 1);
  let best = 0, bestN = 0;
  for (const [n, k] of tally) if (k > best || (k === best && n > bestN)) { best = k; bestN = n; }
  return { value: bestN, share: counts.length ? best / counts.length : 0 };
}

/* en-syllables.js registers itself on the global, the way the browser loads it */
await import('../en-syllables.js').catch(() => console.warn('no en-syllables.js — run tools/build-en-syllables.mjs'));
const { scan } = await import('../syllables.js').then((m) => m.default ?? m);
const opt = parseArgs(process.argv.slice(2));
const poems = loadCorpus();

let total = 0, agree = 0, unsure = 0;
const outliers = [];
const perPoem = [];

for (const id of Object.keys(poems)) {
  if (opt.poem && id !== opt.poem) continue;
  if (opt.lang === 'fr' && SKIP_FR.has(id) && !opt.poem) continue;
  const poem = poems[id];
  const segs = poem.segments || [];
  const lines = segs.map((s) => s[opt.lang] || '');
  if (!lines.some(Boolean)) continue;            /* no translation in this language */

  const place = positions(poem);
  const results = lines.map((l) => (l ? scan(l, opt.lang) : null));

  /* an isometric poem answers globally; otherwise bucket by stanza shape */
  const all = results.filter(Boolean).map((r) => r.count);
  const whole = modal(all);
  const buckets = new Map();
  if (whole.share < 0.75) {
    results.forEach((r, i) => {
      if (!r) return;
      for (const key of [`${place[i]?.len ?? 0}:${place[i]?.pos ?? 0}`, `p${place[i]?.pos ?? 0}`]) {
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(r.count);
      }
    });
    /* a bucket only overrides the poem's overall metre on real evidence: three
       lines agreeing, not two lines of a sonnet that happen to match */
    for (const [k, v] of buckets) {
      const m = modal(v);
      buckets.set(k, v.length >= 3 && m.share >= 0.6 ? m.value : null);
    }
  }
  /* the stanza-shape bucket is the sharpest reading; a bucket on position alone
     pools across stanzas of different lengths; the poem's own metre is the last
     word when neither has enough to say */
  const expectFor = (i) =>
    buckets.get(`${place[i]?.len ?? 0}:${place[i]?.pos ?? 0}`) ??
    buckets.get(`p${place[i]?.pos ?? 0}`) ?? whole.value;

  let poemAgree = 0, poemTotal = 0;
  results.forEach((r, i) => {
    if (!r) return;
    poemTotal++; total++;
    if (r.unsure) unsure++;
    const want = expectFor(i);
    /* an unsure line is credited if either reading lands on the metre */
    const ok = r.count === want || (r.unsure && want >= r.min && want <= r.max);
    if (ok) { poemAgree++; agree++; }
    else outliers.push({ id, i, want, got: r.count, line: lines[i], parts: r.parts });
    if (opt.verbose) {
      console.log(
        `${ok ? '   ' : ' ! '}${String(i + 1).padStart(3)}  ${String(r.count).padStart(2)}/${want}  ` +
        `${r.parts.join('·')}\n        ${lines[i]}`
      );
    }
  });
  perPoem.push({ id, agree: poemAgree, total: poemTotal, metre: whole.share >= 0.9 ? whole.value : 'mixed' });
}

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(2) : '0.00');

console.log(`\n${opt.lang.toUpperCase()}  ${agree}/${total} lines agree with their poem's metre  (${pct(agree, total)}%)`);
console.log(`     ${perPoem.length} poems, ${unsure} lines with an ambiguous diérèse\n`);

const worst = perPoem.filter((p) => p.agree < p.total).sort((a, b) => (a.agree / a.total) - (b.agree / b.total));
if (worst.length && !opt.poem) {
  console.log('Poems with the most disagreement:');
  for (const p of worst.slice(0, 12)) {
    console.log(`  ${pct(p.agree, p.total).padStart(6)}%  ${String(p.total - p.agree).padStart(3)} off  ${p.id} (metre ${p.metre})`);
  }
  console.log('');
}

if (outliers.length && !opt.verbose) {
  console.log(`Outliers (${Math.min(outliers.length, opt.outliers)} of ${outliers.length}):`);
  for (const o of outliers.slice(0, opt.outliers)) {
    console.log(`  ${o.id}:${o.i + 1}  got ${o.got}, poem wants ${o.want}`);
    console.log(`     ${o.line}`);
    console.log(`     ${o.parts.join('·')}`);
  }
}
