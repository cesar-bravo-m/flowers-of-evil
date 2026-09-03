/**
 * meta.js — what a page says about itself.
 *
 * The title, the description and the schema.org graph for any one poem, worked
 * out from the poem's own data and nothing else. Two very different callers
 * need exactly the same answers:
 *
 *   - tools/build-pages.mjs, writing them into each generated page, which is
 *     what a search engine and a link preview read;
 *   - translation.js, rewriting them in the browser when a reader moves from
 *     one poem to the next without a page load, which is what the tab and a
 *     copied URL show.
 *
 * If those two ever disagreed, the page would describe itself one way to a
 * crawler and another way to a reader. So the strings live here once, in plain
 * functions over plain data, and both sides call them. Nothing in this file
 * touches the DOM — the one piece of page context it needs, a poem's section
 * name, is handed in — which is what lets the build script load it under
 * node:vm the same way it loads the poem files.
 */
window.META = (function () {
  'use strict';

  var SITE_URL = 'https://floresdelmal.org';

  var HOME_TITLE = 'Les Fleurs du mal — Baudelaire, with English and Spanish translations';
  var HOME_DESCRIPTION = 'Read Charles Baudelaire’s Les Fleurs du mal (1861) in full — all 133 poems, with English and Spanish translations aligned line by line. Hover a word to see its counterpart.';
  var ABOUT_TITLE = 'About — Les Fleurs du mal';
  var ABOUT_DESCRIPTION = 'About this edition of Baudelaire’s Les Fleurs du mal: the translations it carries, what it keeps on your device, and who made it.';

  var LANG_NAMES = { en: 'English', es: 'Spanish' };
  var TRANSLATORS = {
    en: 'Cyril Scott',
    es: 'Eduardo Marquina',
    'en-bravo': 'César Bravo',
    'es-bravo': 'César Bravo'
  };

  var AUTHOR = {
    '@type': 'Person',
    '@id': SITE_URL + '/#baudelaire',
    name: 'Charles Baudelaire',
    birthDate: '1821-04-09',
    deathDate: '1867-08-31',
    sameAs: 'https://en.wikipedia.org/wiki/Charles_Baudelaire'
  };

  function absoluteUrl(path) { return SITE_URL + '/' + path; }
  function poemUrl(id) { return absoluteUrl('poems/' + id + '/'); }

  function hasLang(poem, lang) {
    var segments = (poem && poem.segments) || [];
    for (var i = 0; i < segments.length; i++) {
      if (segments[i][lang]) return true;
    }
    return false;
  }

  /* Every translation code this poem carries and a reader may see: the two
     public-domain ones where they exist, plus whichever of the site's own are
     marked complete. `bravo` is window.BRAVO, which the build script has too. */
  function translationCodes(id, poems, bravo) {
    var poem = (poems || {})[id];
    if (!poem) return [];
    var codes = [];
    ['en', 'es'].forEach(function (lang) {
      if (hasLang(poem, lang)) codes.push(lang);
    });
    if (bravo) {
      bravo.langsFor(id).forEach(function (lang) {
        if (hasLang(poem, lang) && codes.indexOf(lang) === -1) codes.push(lang);
      });
    }
    return codes;
  }

  /* The same list reduced to plain languages, since prose reads better as
     "English and Spanish translations" than as a list of translators. */
  function translationLangs(id, poems, bravo) {
    var base = { en: 'en', es: 'es', 'en-bravo': 'en', 'es-bravo': 'es' };
    var out = [];
    translationCodes(id, poems, bravo).forEach(function (code) {
      var lang = base[code] || code;
      if (out.indexOf(lang) === -1) out.push(lang);
    });
    return out;
  }

  function joinList(items) {
    if (items.length < 2) return items[0] || '';
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  function translationPhrase(langs) {
    var names = langs.map(function (l) { return LANG_NAMES[l] || l; });
    if (!names.length) return '';
    return joinList(names) + (names.length > 1 ? ' translations' : ' translation');
  }

  /* A result snippet is shown at around 160 characters, so cut there — at a
     word, and without leaving the punctuation that joined it to the next one. */
  function clampWords(text, max) {
    if (text.length <= max) return text;
    var cut = text.slice(0, max - 1);
    var space = cut.lastIndexOf(' ');
    if (space > max * 0.6) cut = cut.slice(0, space);
    return cut.replace(/[\s,;:—-]+$/, '') + '…';
  }

  function poemTitle(poem, langs) {
    var phrase = translationPhrase(langs || []);
    return poem.title + ' — Baudelaire, ' +
      (phrase ? 'with ' + phrase : 'from Les Fleurs du mal (1861)');
  }

  /* Distinct enough to be worth a search result: the poem's own opening line,
     then what the page actually offers. */
  function poemDescription(poem, langs) {
    var phrase = translationPhrase(langs || []);
    var tail = poem.title + ', from Charles Baudelaire’s Les Fleurs du mal (1861)' +
      (phrase ? ', with ' + phrase + ' line by line.' : '.');
    /* U+FEFF: a few lines of the corpus carry a stray one, and a description
       is not escaped on its way into the markup the way verse is. */
    var opening = ((poem.segments && poem.segments[0] && poem.segments[0].fr) || '')
      .replace(/﻿/g, '');
    if (!opening) return clampWords(tail, 160);
    /* The quotation is what gives way when the whole will not fit — a half
       sentence of it still reads, whereas a description cut off before it has
       said what the page offers does not. */
    var room = 160 - tail.length - 5;
    if (room < 24) return clampWords(tail, 160);
    return '“' + clampWords(opening.replace(/[\s,;:]+$/, ''), room) + '” — ' + tail;
  }

  /* The book every poem belongs to. Repeated per page under one @id, which is
     how a consumer knows the 133 Poem nodes are parts of one work. */
  function bookNode() {
    return {
      '@type': 'Book',
      '@id': SITE_URL + '/#book',
      name: 'Les Fleurs du mal',
      alternateName: ['The Flowers of Evil', 'Las flores del mal'],
      datePublished: '1861',
      inLanguage: 'fr',
      genre: 'Poetry',
      author: AUTHOR,
      url: SITE_URL + '/',
      sameAs: 'https://en.wikipedia.org/wiki/Les_Fleurs_du_mal'
    };
  }

  /**
   * The graph for one poem's page: the poem itself, each translation of it as a
   * work in its own right, and the trail back to the book.
   *
   * opts: { id, poem, section, codes }  — `section` is the human name of the
   * part of the book the poem sits in ("Spleen et Idéal"), which is the only
   * thing this file cannot work out for itself.
   */
  function poemJsonLd(opts) {
    var poem = opts.poem;
    var id = opts.id;
    var url = poemUrl(id);
    var codes = opts.codes || [];

    var alternates = [];
    Object.keys(poem.titles || {}).forEach(function (lang) {
      var name = poem.titles[lang];
      if (lang !== 'fr' && name && name !== poem.title && alternates.indexOf(name) === -1) {
        alternates.push(name);
      }
    });

    var translations = codes.map(function (code) {
      var node = {
        '@type': 'Poem',
        name: (poem.titles && poem.titles[code]) || poem.title,
        inLanguage: code.indexOf('es') === 0 ? 'es' : 'en'
      };
      if (TRANSLATORS[code]) node.translator = { '@type': 'Person', name: TRANSLATORS[code] };
      return node;
    });

    var poemNode = {
      '@type': 'Poem',
      '@id': url + '#poem',
      name: poem.title,
      url: url,
      description: poemDescription(poem, translationLangsOf(codes)),
      inLanguage: 'fr',
      datePublished: '1861',
      genre: 'Poetry',
      author: AUTHOR,
      isPartOf: { '@id': SITE_URL + '/#book' }
    };
    if (alternates.length) poemNode.alternateName = alternates;
    if (translations.length) poemNode.workTranslation = translations;

    var crumbs = [{
      '@type': 'ListItem', position: 1, name: 'Les Fleurs du mal', item: SITE_URL + '/'
    }];
    if (opts.section) {
      crumbs.push({ '@type': 'ListItem', position: 2, name: opts.section });
    }
    crumbs.push({
      '@type': 'ListItem', position: crumbs.length + 1, name: poem.title, item: url
    });

    return {
      '@context': 'https://schema.org',
      '@graph': [
        poemNode,
        bookNode(),
        { '@type': 'BreadcrumbList', itemListElement: crumbs }
      ]
    };
  }

  function translationLangsOf(codes) {
    var base = { en: 'en', es: 'es', 'en-bravo': 'en', 'es-bravo': 'es' };
    var out = [];
    codes.forEach(function (code) {
      var lang = base[code] || code;
      if (out.indexOf(lang) === -1) out.push(lang);
    });
    return out;
  }

  return {
    SITE_URL: SITE_URL,
    HOME_TITLE: HOME_TITLE,
    HOME_DESCRIPTION: HOME_DESCRIPTION,
    ABOUT_TITLE: ABOUT_TITLE,
    ABOUT_DESCRIPTION: ABOUT_DESCRIPTION,
    absoluteUrl: absoluteUrl,
    poemUrl: poemUrl,
    translationCodes: translationCodes,
    translationLangs: translationLangs,
    translationLangsOf: translationLangsOf,
    poemTitle: poemTitle,
    poemDescription: poemDescription,
    poemJsonLd: poemJsonLd
  };
})();
