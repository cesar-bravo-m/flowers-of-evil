/**
 * Translations written for this site by Bravo — as opposed to the two
 * public-domain ones the poem files carry (Cyril Scott for English, Eduardo
 * Marquina for Spanish).
 *
 * A poem file may end with a machine-managed block that localhost edit mode
 * appends and rewrites:
 *
 *     window.POEMS["le-chat-1"].bravo = {
 *       "en-bravo": { status: "complete", title: "The Cat", lines: [ ... ] }
 *     };
 *
 * `lines` is index-aligned with `segments`, so line i of the translation is
 * line i of the poem; an untranslated line is the empty string. This file
 * folds those blocks into the ordinary data model, so nothing downstream needs
 * to know they arrived by a different route: a Bravo translation is just
 * another language key on a segment, and renders, highlights, searches and
 * credits itself exactly as `en` and `es` do.
 *
 * Visibility is decided here rather than by withholding the data. A draft is
 * folded in like any other translation, but `langsFor()` names only the
 * complete ones — and that is what the reader's dropdown and the search index
 * are built from. Edit mode asks `all()` instead, and so can preview its own
 * unfinished work without any of it reaching a reader.
 */
(function () {
  var LANGS = ['en-bravo', 'es-bravo'];

  /* The plain language each code is a translation into. Used where something
     only knows about `en` / `es` — the home extract's two buttons, Wiktionary. */
  var BASE = { 'en-bravo': 'en', 'es-bravo': 'es' };

  /* Stands in for the `sources` entry the curated translations carry. No URL:
     there is nothing to link to, and `buildSourceCell()` already copes. */
  var CREDIT = {
    'en-bravo': 'Translated by César Bravo (2026)',
    'es-bravo': 'Traducido por César Bravo (2026)'
  };

  function poemOf(poemId) {
    return (window.POEMS && window.POEMS[poemId]) || null;
  }

  function entry(poemId, lang) {
    var poem = poemOf(poemId);
    var e = poem && poem.bravo && poem.bravo[lang];
    return e && e.lines ? e : null;
  }

  /* Every Bravo language this poem has any text for, finished or not. */
  function all(poemId) {
    return LANGS.filter(function (lang) { return !!entry(poemId, lang); });
  }

  /* Only the ones marked fully translated. This is the reader's view. */
  function langsFor(poemId) {
    return LANGS.filter(function (lang) {
      var e = entry(poemId, lang);
      return !!e && e.status === 'complete';
    });
  }

  /* Fold one poem's block onto its segments, titles and sources. Idempotent,
     and it clears as well as sets, so edit mode can re-apply after a save and
     a language that lost its last line disappears again. */
  function apply(poemId) {
    var poem = poemOf(poemId);
    if (!poem) return;
    var segments = poem.segments || [];

    LANGS.forEach(function (lang) {
      var e = entry(poemId, lang);
      for (var i = 0; i < segments.length; i++) {
        var line = e && e.lines[i];
        if (line) segments[i][lang] = line;
        else delete segments[i][lang];
      }
      if (poem.titles) {
        if (e && e.title) poem.titles[lang] = e.title;
        else delete poem.titles[lang];
      }
      if (poem.sources) {
        if (e) poem.sources[lang] = CREDIT[lang];
        else delete poem.sources[lang];
      }
    });
  }

  function applyAll() {
    if (!window.POEMS) return;
    Object.keys(window.POEMS).forEach(apply);
  }

  window.BRAVO = {
    LANGS: LANGS,
    CREDIT: CREDIT,
    isBravo: function (lang) { return LANGS.indexOf(lang) !== -1; },
    base: function (lang) { return BASE[lang] || lang; },
    entry: entry,
    all: all,
    langsFor: langsFor,
    apply: apply
  };

  applyAll();
})();
