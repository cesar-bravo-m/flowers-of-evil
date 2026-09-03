/**
 * selftest.mjs — hand-verified cases for syllables.js.
 *
 * check-meter.mjs scores French against the corpus, which works because
 * Baudelaire's metre is strict. That trick is unavailable for the other two:
 * Marquina's Spanish is not metrical at all (his counts scatter from 11 to 18),
 * and Scott's English is only loosely so. English is instead measured word by
 * word against cmudict at build time; Spanish, whose rules are deterministic,
 * is pinned here.
 *
 *   node tools/selftest.mjs
 */
await import('../en-syllables.js').catch(() => {});
const { scan } = await import('../syllables.js').then((m) => m.default ?? m);

const CASES = {
  es: [
    /* scan() returns the *metrical* count, so a line ending on an aguda gains a
       syllable and one ending on an esdrújula loses one — hence ciudad 2+1 and
       rápido 3-1. */
    ['cielo', 2], ['aire', 2], ['poeta', 3], ['día', 2], ['ciudad', 3],
    ['ahora', 3], ['raíz', 3], ['león', 3], ['huésped', 2], ['rápido', 2],
    ['Volverán las oscuras golondrinas', 11],
    ['Hombres necios que acusáis', 8],
    ['En un lugar de la Mancha', 8],
    ['Su madre, espantada y llena de blasfemias', 12],
    ['la vida es sueño', 5]
  ],
  en: [
    ['Shall I compare thee to a summer', 9],
    ['The curfew tolls the knell of parting day', 10],
    ['When by the changeless Power of a Supreme', 11],
    ['beautiful', 3], ['nation', 2], ['lion', 2], ['prism', 2], ['flying', 2],
    ['cages', 2], ['makes', 1], ['abed', 2]
  ],
  fr: [
    ['Lorsque, par un décret des puissances supremes,', 12],
    ['Le Poëte apparaît en ce monde ennuyé,', 12],
    ['C’est l’Ennui ! — l’œil chargé d’un pleur involontaire,', 12],
    ['Sans horreur, à travers des ténèbres qui puent.', 12],
    ['Race de Caïn, tes entrailles', 8],
    ['Et laisse-moi plonger dans tes beaux yeux,', 10],
    ['Les soleils mouillés', 5],
    ['Adorerai-je aussi ta neige et vos frimas,', 12]
  ]
};

let pass = 0, fail = 0;
for (const [lang, cases] of Object.entries(CASES)) {
  for (const [text, want] of cases) {
    const r = scan(text, lang);
    const ok = r.count === want || (r.unsure && want >= r.min && want <= r.max);
    if (ok) pass++;
    else {
      fail++;
      console.log(`  FAIL ${lang}  got ${r.count}${r.unsure ? `(${r.min}-${r.max})` : ''}, want ${want}`);
      console.log(`       ${text}`);
      console.log(`       ${r.parts.join('·')}`);
    }
  }
}
console.log(`\nselftest: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
