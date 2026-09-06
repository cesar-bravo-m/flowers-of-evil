/**
 * General-purpose translation alignment: render poem from TRANSLATION_SEGMENTS
 * and sync highlight on hover/selection across all languages.
 * Add columns in HTML with data-lang="fr" (etc.) and data-lines-per-stanza="4".
 */
(function () {
  'use strict';

  var HIGHLIGHT_CLASS = 'translation-highlight';
  var HIGHLIGHT_SELECTION_CLASS = 'translation-highlight-selection';
  var WORD_HIGHLIGHT_CLASS = 'word-group-highlight';
  var LINES_PER_STANZA = 4;

  var POEM_SECTIONS = {
    'au-lecteur': 'au-lecteur',
    'benediction': 'spleen-et-ideal',
    'l-albatros': 'spleen-et-ideal',
    'elevation': 'spleen-et-ideal',
    'correspondances': 'spleen-et-ideal',
    'j-aime-le-souvenir': 'spleen-et-ideal',
    'les-phares': 'spleen-et-ideal',
    'la-muse-malade': 'spleen-et-ideal',
    'la-muse-venale': 'spleen-et-ideal',
    'le-mauvais-moine': 'spleen-et-ideal',
    'l-ennemi': 'spleen-et-ideal',
    'le-guignon': 'spleen-et-ideal',
    'la-vie-anterieure': 'spleen-et-ideal',
    'bohemiens-en-voyage': 'spleen-et-ideal',
    'l-homme-et-la-mer': 'spleen-et-ideal',
    'don-juan-aux-enfers': 'spleen-et-ideal',
    'chatiment-de-l-orgueil': 'spleen-et-ideal',
    'la-beaute': 'spleen-et-ideal',
    'l-ideal': 'spleen-et-ideal',
    'la-geante': 'spleen-et-ideal',
    'le-masque': 'spleen-et-ideal',
    'hymne-a-la-beaute': 'spleen-et-ideal',
    'parfum-exotique': 'spleen-et-ideal',
    'la-chevelure': 'spleen-et-ideal',
    'je-t-adore': 'spleen-et-ideal',
    'tu-mettrais-l-univers': 'spleen-et-ideal',
    'sed-non-satiata': 'spleen-et-ideal',
    'vetements-ondoyants': 'spleen-et-ideal',
    'le-serpent-qui-danse': 'spleen-et-ideal',
    'une-charogne': 'spleen-et-ideal',
    'de-profundis-clamavi': 'spleen-et-ideal',
    'le-vampire': 'spleen-et-ideal',
    'une-nuit-que-j-etais': 'spleen-et-ideal',
    'remords-posthume': 'spleen-et-ideal',
    'le-chat-1': 'spleen-et-ideal',
    'duellum': 'spleen-et-ideal',
    'le-balcon': 'spleen-et-ideal',
    'le-possede': 'spleen-et-ideal',
    'un-fantome': 'spleen-et-ideal',
    'je-te-donne-ces-vers': 'spleen-et-ideal',
    'semper-eadem': 'spleen-et-ideal',
    'tout-entiere': 'spleen-et-ideal',
    'que-diras-tu-ce-soir': 'spleen-et-ideal',
    'le-flambeau-vivant': 'spleen-et-ideal',
    'reversibilite': 'spleen-et-ideal',
    'confession': 'spleen-et-ideal',
    'l-aube-spirituelle': 'spleen-et-ideal',
    'harmonie-du-soir': 'spleen-et-ideal',
    'le-flacon': 'spleen-et-ideal',
    'le-poison': 'spleen-et-ideal',
    'ciel-brouille': 'spleen-et-ideal',
    'le-chat-2': 'spleen-et-ideal',
    'le-beau-navire': 'spleen-et-ideal',
    'l-invitation-au-voyage': 'spleen-et-ideal',
    'l-irreparable': 'spleen-et-ideal',
    'causerie': 'spleen-et-ideal',
    'chant-d-automne': 'spleen-et-ideal',
    'a-une-madone': 'spleen-et-ideal',
    'chanson-d-apres-midi': 'spleen-et-ideal',
    'sisina': 'spleen-et-ideal',
    'franciscae-meae-laudes': 'spleen-et-ideal',
    'a-une-dame-creole': 'spleen-et-ideal',
    'moesta-et-errabunda': 'spleen-et-ideal',
    'le-revenant': 'spleen-et-ideal',
    'sonnet-d-automne': 'spleen-et-ideal',
    'tristesses-de-la-lune': 'spleen-et-ideal',
    'les-chats': 'spleen-et-ideal',
    'les-hiboux': 'spleen-et-ideal',
    'la-pipe': 'spleen-et-ideal',
    'la-musique': 'spleen-et-ideal',
    'sepulture': 'spleen-et-ideal',
    'une-gravure-fantastique': 'spleen-et-ideal',
    'le-mort-joyeux': 'spleen-et-ideal',
    'le-tonneau-de-la-haine': 'spleen-et-ideal',
    'la-cloche-felee': 'spleen-et-ideal',
    'spleen-1': 'spleen-et-ideal',
    'spleen-2': 'spleen-et-ideal',
    'spleen-3': 'spleen-et-ideal',
    'spleen-4': 'spleen-et-ideal',
    'obsession': 'spleen-et-ideal',
    'le-gout-du-neant': 'spleen-et-ideal',
    'alchimie-de-la-douleur': 'spleen-et-ideal',
    'horreur-sympathique': 'spleen-et-ideal',
    'l-heautontimoroumenos': 'spleen-et-ideal',
    'l-irremediable': 'spleen-et-ideal',
    'l-horloge': 'spleen-et-ideal',
    'paysage': 'tableaux-parisiens',
    'le-soleil': 'tableaux-parisiens',
    'a-une-mendiante-rousse': 'tableaux-parisiens',
    'le-cygne': 'tableaux-parisiens',
    'les-sept-vieillards': 'tableaux-parisiens',
    'les-petites-vieilles': 'tableaux-parisiens',
    'les-aveugles': 'tableaux-parisiens',
    'a-une-passante': 'tableaux-parisiens',
    'le-squelette-laboureur': 'tableaux-parisiens',
    'le-crepuscule-du-soir': 'tableaux-parisiens',
    'le-jeu': 'tableaux-parisiens',
    'danse-macabre': 'tableaux-parisiens',
    'l-amour-du-mensonge': 'tableaux-parisiens',
    'je-n-ai-pas-oublie': 'tableaux-parisiens',
    'la-servante-au-grand-coeur': 'tableaux-parisiens',
    'brumes-et-pluies': 'tableaux-parisiens',
    'reve-parisien': 'tableaux-parisiens',
    'le-crepuscule-du-matin': 'tableaux-parisiens',
    'l-ame-du-vin': 'le-vin',
    'le-vin-des-chiffonniers': 'le-vin',
    'le-vin-de-l-assassin': 'le-vin',
    'le-vin-du-solitaire': 'le-vin',
    'le-vin-des-amants': 'le-vin',
    'la-destruction': 'fleurs-du-mal',
    'une-martyre': 'fleurs-du-mal',
    'femmes-damnees': 'fleurs-du-mal',
    'les-deux-bonnes-soeurs': 'fleurs-du-mal',
    'la-fontaine-de-sang': 'fleurs-du-mal',
    'allegorie': 'fleurs-du-mal',
    'la-beatrice': 'fleurs-du-mal',
    'un-voyage-a-cythere': 'fleurs-du-mal',
    'l-amour-et-le-crane': 'fleurs-du-mal',
    'le-reniement-de-saint-pierre': 'revolte',
    'abel-et-cain': 'revolte',
    'les-litanies-de-satan': 'revolte',
    'la-mort-des-amants': 'la-mort',
    'la-mort-des-pauvres': 'la-mort',
    'la-mort-des-artistes': 'la-mort',
    'la-fin-de-la-journee': 'la-mort',
    'le-reve-d-un-curieux': 'la-mort',
    'le-voyage': 'la-mort',
    'les-bijoux': 'pieces-condamnees',
    'le-lethe': 'pieces-condamnees',
    'a-celle-qui-est-trop-gaie': 'pieces-condamnees',
    'lesbos': 'pieces-condamnees',
    'femmes-damnees-delphine-et-hippolyte': 'pieces-condamnees',
    'les-metamorphoses-du-vampire': 'pieces-condamnees',
  };

  function getLanguages() {
    var segments = window.TRANSLATION_SEGMENTS;
    if (!segments || !segments.length) return [];
    var keys = Object.keys(segments[0]).filter(function (k) { return k !== 'id'; });
    return keys;
  }

  function showLineNumber(segmentIndex) {
    var n = segmentIndex + 1;
    return n === 1 || (n % 5 === 0);
  }

  function renderWordGroupContent(lang, seg) {
    var text = seg[lang];
    if (text == null) return '';
    if (!seg.wordGroups || !seg.wordGroups.length) return escapeHtml(text);

    // Find positions of each word group substring in the line
    var matches = [];
    var claimed = []; // track claimed character ranges
    for (var g = 0; g < seg.wordGroups.length; g++) {
      var group = seg.wordGroups[g];
      var substr = group[lang];
      if (substr == null || substr === '') continue;
      var startFrom = 0;
      var pos = -1;
      // Find first occurrence not already claimed
      while (true) {
        pos = text.indexOf(substr, startFrom);
        if (pos === -1) break;
        var end = pos + substr.length;
        var overlap = false;
        for (var c = 0; c < claimed.length; c++) {
          if (pos < claimed[c][1] && end > claimed[c][0]) { overlap = true; break; }
        }
        if (!overlap) break;
        startFrom = pos + 1;
      }
      if (pos === -1) continue;
      matches.push({ pos: pos, end: pos + substr.length, wid: group.wid, text: substr });
      claimed.push([pos, pos + substr.length]);
    }

    // Sort by position
    matches.sort(function (a, b) { return a.pos - b.pos; });

    // Build HTML with word-group spans interspersed with plain text
    var html = '';
    var cursor = 0;
    for (var m = 0; m < matches.length; m++) {
      if (matches[m].pos > cursor) {
        html += escapeHtml(text.substring(cursor, matches[m].pos));
      }
      html += '<span class="word-group" data-wid="' + matches[m].wid + '">' + escapeHtml(matches[m].text) + '</span>';
      cursor = matches[m].end;
    }
    if (cursor < text.length) {
      html += escapeHtml(text.substring(cursor));
    }
    return html;
  }

  function renderLine(lang, seg) {
    var text = seg[lang];
    if (text == null) return '';
    var innerHtml = renderWordGroupContent(lang, seg);
    var segmentHtml = '<span class="translation-segment" data-tid="' + seg.id + '">' + innerHtml + '</span>';
    if (lang === 'fr') {
      var numHtml = showLineNumber(seg.id)
        ? '<span class="line-number" aria-hidden="true">' + (seg.id + 1) + '</span>'
        : '<span class="line-number" aria-hidden="true"></span>';
      return '<div class="line">' + numHtml + segmentHtml + '</div>';
    }
    return segmentHtml;
  }

  function renderStanza(block, lang) {
    var parts = block.map(function (seg) { return renderLine(lang, seg); }).filter(Boolean);
    if (lang === 'fr') {
      return parts.join('\n        ');
    }
    return parts.join('<br>\n        ');
  }

  /* Only public-domain translations are carried in the poem files (Cyril Scott
     for English, Eduardo Marquina for Spanish). Where none exists the language
     key is simply absent from every segment, and the column shows a note
     instead of verse. */
  function poemHasLang(lang) {
    if (lang === 'fr') return true;
    var segments = window.TRANSLATION_SEGMENTS;
    if (!segments || !segments.length) return false;
    for (var i = 0; i < segments.length; i++) {
      var v = segments[i][lang];
      if (v != null && v !== '') return true;
    }
    return false;
  }

  function missingTranslationHtml(lang) {
    var name = COLUMN_TITLES[lang] || lang;
    return '<div class="translation-missing">' +
      '<p class="translation-missing-title">No ' + escapeHtml(name) + ' translation yet</p>' +
      '<p class="translation-missing-note"></p>' +
      '</div>';
  }

  function renderPoem(lang) {
    var segments = window.TRANSLATION_SEGMENTS;
    var blocks = window.TRANSLATION_BLOCKS;
    if (!segments || !segments.length) return [];
    var missing = !poemHasLang(lang);
    if (!blocks || !blocks.length) {
      /* fallback: derive stanza + blank between stanzas from segment count */
      blocks = [];
      for (var s = 0; s < segments.length; s += LINES_PER_STANZA) {
        blocks.push({ type: 'stanza' });
        if (s + LINES_PER_STANZA < segments.length) blocks.push({ type: 'blank' });
      }
    }

    var segmentIndex = 0;
    var result = [];
    for (var b = 0; b < blocks.length; b++) {
      if (blocks[b].type === 'blank') {
        result.push({ type: 'blank' });
      } else if (blocks[b].type === 'part') {
        result.push({ type: 'part', label: blocks[b].label || '' });
      } else if (blocks[b].type === 'stanza') {
        /* honour a per-stanza line count when the poem declares one, so sonnets
           and other irregular forms keep their real shape */
        var take = blocks[b].lines || LINES_PER_STANZA;
        var block = segments.slice(segmentIndex, segmentIndex + take);
        segmentIndex += take;
        if (!block.length) continue;
        if (missing) {
          /* keep one entry per block so the row count still matches the French
             column; the note rides on the first stanza, the rest stay empty */
          var firstStanza = !result.some(function (r) { return r.type === 'stanza'; });
          result.push({ type: 'stanza', missing: true, html: firstStanza ? missingTranslationHtml(lang) : '' });
        } else {
          result.push({ type: 'stanza', html: renderStanza(block, lang) });
        }
      }
    }
    return result;
  }

  /* A handful of lines in the corpus carry a stray U+FEFF, left over from how
     the French was gathered. It is invisible on screen but it lands in the text
     a search engine indexes and in anything copied out of the page, so it goes
     here — at the one point every line passes through on its way to the DOM —
     rather than by rewriting the poem files. */
  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = String(s).replace(/﻿/g, '');
    return div.innerHTML;
  }

  /* Every translation is named for its translator, since there are now two of
     each language: the public-domain ones the poem files carry, and the site's
     own. This one table feeds the column heading, the dropdown trigger, the
     dropdown options and the no-translation-yet note. */
  var COLUMN_TITLES = {
    fr: 'Français',
    en: 'English (Scott)',
    es: 'Español (Marquina)',
    'en-bravo': 'English (Bravo)',
    'es-bravo': 'Español (Bravo)'
  };
  var currentTranslationLang = 'en';
  /* What the reader last asked for, as distinct from what the poem in front of
     them can actually show. Kept apart so that one Spanish-only poem does not
     leave every poem after it in Spanish. */
  var preferredTranslationLang = 'en';

  /* Which translations the dropdown offers for the poem now open: the two
     public-domain ones the markup names, plus whichever of the site's own are
     finished. Edit mode asks for the unfinished ones too, so that a draft can
     be previewed in the reader without ever being offered to a reader. */
  function availableTranslationLangs() {
    var comparison = document.querySelector('.comparison');
    var attr = comparison && comparison.getAttribute('data-translation-langs');
    var langs = (attr || 'en,es').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (window.BRAVO && window.CURRENT_POEM_ID) {
      var editing = document.body.classList.contains('edit-mode');
      var own = editing ? window.BRAVO.all(window.CURRENT_POEM_ID)
        : window.BRAVO.langsFor(window.CURRENT_POEM_ID);
      own.forEach(function (lang) {
        if (langs.indexOf(lang) === -1) langs.push(lang);
      });
    }
    return langs;
  }

  /* Every code a translation cell may ever have carried, so a language swap can
     clear the class the previous one left behind. */
  function allTranslationLangs() {
    return ['en', 'es'].concat(window.BRAVO ? window.BRAVO.LANGS : []);
  }

  /* The poem the address names, picked before the first build so that the grid
     is rendered once rather than built and then switched. */
  /* --- Knowing a poem before it has arrived --------------------------------
     A page loads the poem it is about and lets corpus.js fetch the rest in its
     own time, so window.POEMS is sparse for a moment after load — while the
     sidebar has to list all 133 titles and prev/next has to name two of them.
     poems.js carries exactly that much for every poem, so read the file where
     it is here and the manifest where it is not. Both answer to the same two
     keys, `title` and `titles`, which is what lets one accessor serve. */

  function poemMeta(id) {
    if (!id) return null;
    var loaded = window.POEMS && window.POEMS[id];
    if (loaded && loaded.segments) return loaded;
    return (window.POEM_INDEX && window.POEM_INDEX[id]) || loaded || null;
  }

  /* Is this an id the site has at all — loaded or merely listed? */
  function poemExists(id) {
    return !!poemMeta(id);
  }

  function applyInitialRoute() {
    if (!window.POEMS || !window.POEM_IDS || !window.POEM_IDS.length) return;
    var route = currentRoute();
    var id = route.view === 'poem' ? route.id : null;
    if (id && window.POEMS[id]) {
      window.CURRENT_POEM_ID = id;
      window.TRANSLATION_SEGMENTS = window.POEMS[id].segments;
      window.TRANSLATION_BLOCKS = window.POEMS[id].blocks;
    }
  }

  /* --- Addresses ----------------------------------------------------------
     Every poem has a real URL of its own — /poems/<id>/ — written out by
     tools/build-pages.mjs as a page that already carries the verse in its
     HTML. That is what a search engine indexes, what a shared link opens and
     what Back returns to; the hash form this site used to use
     (#une-charogne) still works, and applyRoute() quietly replaces it with
     the real address so there is only ever one URL per poem.

     `data-base` on <html> says how far the current page sits below the site
     root — "" at the root, "../../" on a poem page — so one set of helpers
     builds correct links from either. Opened straight off disk there are no
     directory indexes, so the file name goes back on the end. */

  var BASE = document.documentElement.getAttribute('data-base') || '';
  var IS_FILE = window.location.protocol === 'file:';
  /* Whether a click can become a history entry rather than a page load. On
     file:// it cannot, and the real links take over instead. */
  var CAN_PUSH = !IS_FILE && !!(window.history && window.history.pushState);

  function routeHref(path) {
    var href = BASE + path;
    if (IS_FILE) href += 'index.html';
    return href || './';
  }

  function poemHref(id) { return routeHref('poems/' + id + '/'); }
  function homeHref() { return routeHref(''); }
  function aboutHref() { return routeHref('about/'); }

  /* Where this document was actually loaded from. It matters because pushState
     changes the address in the bar and relative URLs resolve against that: push
     "poems/le-vampire/" while the bar already says /poems/une-charogne/ and you
     get /poems/une-charogne/poems/le-vampire/. Resolving against the load
     address instead keeps every push correct however many have come before —
     and, because it is derived rather than assumed, the site still works served
     from a subdirectory. */
  var DOC_URL = window.location.href;

  function setUrl(href, replace) {
    if (!CAN_PUSH) return;
    try {
      var url = new URL(href, DOC_URL);
      /* No fragment: the poem has a path of its own now, and a stale
         #une-charogne left in the bar would outrank it on the next read. */
      window.history[replace ? 'replaceState' : 'pushState'](null, '', url.pathname + url.search);
    } catch (e) { /* nothing to do; the page is still on the right view */ }
  }

  /* Should a click on this link be handled in the page? Only a plain left
     click on a same-tab link: a modified click is the reader asking for a new
     tab, and a real href is now there to give them one. */
  function isPlainClick(e) {
    return CAN_PUSH && e.button === 0 &&
      !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;
  }

  /* --- Routes -------------------------------------------------------------
     Three views share this document: a poem, the home page and the about page.
     `data-view` on <body> says which one the stylesheet reveals, and the path
     is the address. Anything unrecognised lands on home. */

  var STATIC_VIEWS = { home: 1, about: 1 };

  /* What the current address names. The path is read first, since that is the
     real address; the hash is only consulted for links written back when the
     poems had no URLs of their own, and is marked `legacy` so applyRoute()
     knows to replace it. */
  function currentRoute() {
    var path = window.location.pathname;
    var m = path.match(/\/poems\/([^\/]+)(?:\/(?:index\.html)?)?$/);
    if (m) return { view: 'poem', id: decodeURIComponent(m[1]) };
    if (/\/about(?:\/(?:index\.html)?)?$/.test(path)) return { view: 'about' };

    var hash = window.location.hash.slice(1);
    if (hash && poemExists(hash)) {
      return { view: 'poem', id: hash, legacy: true };
    }
    if (STATIC_VIEWS[hash]) return { view: hash, legacy: true };
    return { view: 'home' };
  }

  /* --- Page metadata ------------------------------------------------------
     The title, the description, the canonical URL, the link-preview cards and
     the schema.org graph. tools/build-pages.mjs writes all of it into every
     generated page, so a crawler reads it without running anything; what
     follows keeps it true when a reader moves between poems without a page
     load, which is what the browser tab and a copied URL show.

     The strings themselves are in meta.js, which the build script loads too —
     the one way to be sure the page describes itself the same way to a crawler
     and to a reader. */

  /* The human name of a poem's section, read off the sidebar rather than
     duplicated — the same trick search.js uses for its result labels. It is
     the only page context meta.js cannot work out for itself. */
  function sectionName(id) {
    var slug = POEM_SECTIONS[id];
    if (!slug) return '';
    var el = document.querySelector('[data-section-toggle="' + slug + '"] .sidebar-section-name');
    return el ? el.textContent.trim() : '';
  }

  function setMetaContent(selector, value) {
    var el = document.head.querySelector(selector);
    if (el && value) el.setAttribute('content', value);
  }

  /* Called whenever the view changes: after a poem switch, and after a written
     page is shown. Degrades to leaving the markup alone if meta.js is absent. */
  function updateMeta() {
    var META = window.META;
    if (!META) return;
    var view = getView();
    var id = window.CURRENT_POEM_ID;
    var poem = view === 'poem' && window.POEMS ? window.POEMS[id] : null;
    var title, description, url, type, data = null;

    if (poem) {
      var codes = META.translationCodes(id, window.POEMS, window.BRAVO);
      var langs = META.translationLangsOf(codes);
      title = META.poemTitle(poem, langs);
      description = META.poemDescription(poem, langs);
      url = META.poemUrl(id);
      type = 'article';
      data = META.poemJsonLd({ id: id, poem: poem, codes: codes, section: sectionName(id) });
    } else if (view === 'about') {
      title = META.ABOUT_TITLE;
      description = META.ABOUT_DESCRIPTION;
      url = META.absoluteUrl('about/');
      type = 'website';
    } else {
      title = META.HOME_TITLE;
      description = META.HOME_DESCRIPTION;
      url = META.absoluteUrl('');
      type = 'website';
    }

    document.title = title;
    setMetaContent('meta[name="description"]', description);
    var canonical = document.head.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', url);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[property="og:url"]', url);
    setMetaContent('meta[property="og:type"]', type);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);

    var el = document.getElementById('ld-json');
    if (el && data) el.textContent = JSON.stringify(data, null, 2);
  }

  /* The handful of strings the written pages build in script rather than carry
     in the markup; everything else bilingual lives in index.html. */
  var UI_TEXT = {
    about: { en: 'About', es: 'Acerca de' },
    demoOpen: { en: 'Read %s in full \u2192', es: 'Leer %s completo \u2192' },
    demoLangs: { en: 'Choose translation language', es: 'Elegir idioma de la traducción' }
  };

  function siteLang() {
    return (window.SITE_LANG && window.SITE_LANG.get()) || 'en';
  }

  function t(key) {
    var strings = UI_TEXT[key];
    if (!strings) return '';
    return window.SITE_LANG ? window.SITE_LANG.pick(strings) : strings.en;
  }

  function staticTitle(view) {
    return view === 'about' ? t('about') : 'Les Fleurs du mal';
  }

  function getView() {
    return document.body.getAttribute('data-view') || 'poem';
  }

  function setView(view) {
    document.body.setAttribute('data-view', view);
    var home = document.querySelector('.sidebar-title');
    if (home) home.classList.toggle('active', view === 'home');
    var about = document.querySelector('.sidebar-foot-link');
    if (about) about.classList.toggle('active', view === 'about');
    /* No poem is current while a page is up; switchPoem marks one again. */
    if (view !== 'poem') {
      document.querySelectorAll('.sidebar a[data-poem-id]').forEach(function (a) {
        a.classList.remove('active');
        a.setAttribute('aria-current', 'false');
      });
    }
  }

  /* Is the markup for one of the written pages in this document at all? Only
     the two pages that are them carry it — a poem page would be shipping 8 KB
     of prose it never shows — so from anywhere else, going to one is an
     ordinary page load rather than a change of view. */
  function hasStaticMarkup(view) {
    return !!document.getElementById('view-' + view);
  }

  function showStatic(view, scroll) {
    if (!STATIC_VIEWS[view]) view = 'home';
    if (!hasStaticMarkup(view)) {
      window.location.href = view === 'about' ? aboutHref() : homeHref();
      return;
    }
    setView(view);
    closeDrawer();
    setPoemTitle(staticTitle(view));
    updateMeta();
    if (scroll !== false && window.scrollTo) {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }

  /* Runs on load and on every hash change, so Back and Forward move between
     poems and pages as one would expect. */
  function applyRoute(scroll) {
    var route = currentRoute();
    if (route.view === 'poem' && poemExists(route.id)) {
      /* An old #poem-id link: swap the bar over to the real address without
         adding a history entry, so the poem has one URL from here on. */
      if (route.legacy) setUrl(poemHref(route.id), true);
      if (route.id !== window.CURRENT_POEM_ID || getView() !== 'poem') {
        switchPoem(route.id, false);
      } else {
        updateMeta();
      }
      return;
    }
    var view = STATIC_VIEWS[route.view] ? route.view : 'home';
    if (route.legacy) setUrl(view === 'about' ? aboutHref() : homeHref(), true);
    showStatic(view, scroll);
  }

  /* Where `Start reading` goes. The book opens on `Au lecteur`, which is the
     preface rather than a poem — a reader asking to start should land on the
     first poem proper. */
  var FIRST_POEM_ID = 'benediction';

  function firstPoemId() {
    var ids = window.POEM_IDS || [];
    if (poemExists(FIRST_POEM_ID)) return FIRST_POEM_ID;
    return ids[0];
  }

  function initRoutes() {
    var start = document.querySelector('.start-reading');
    if (start) start.addEventListener('click', function () {
      var id = firstPoemId();
      if (id) switchPoem(id);
    });
    /* Both ways in wear the same class: the button beside `Start reading` on
       home, and the middle seat of the reader's own nav. */
    document.querySelectorAll('.random-poem').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = getRandomPoemId();
        if (id) switchPoem(id);
      });
    });
    /* Real URLs mean real history entries, so popstate is now the one that
       matters; hashchange stays for links still written with a fragment. */
    window.addEventListener('popstate', function () { applyRoute(); });
    window.addEventListener('hashchange', function () { applyRoute(); });

    /* Home and About are ordinary links — a crawler follows them, a reader can
       open them in a new tab — and a plain click is handled here instead. */
    document.querySelectorAll('a[data-route]').forEach(function (a) {
      var view = a.getAttribute('data-route');
      if (!STATIC_VIEWS[view]) return;
      /* The markup carries the address a server would serve — "about/" — and
         opened off disk there is no directory index to serve it, so name the
         file. The sidebar and the prev/next links get this from poemHref(). */
      a.href = view === 'about' ? aboutHref() : homeHref();
      a.addEventListener('click', function (e) {
        if (!isPlainClick(e)) return;
        /* From a poem page there is no such view to show — the markup lives
           only on the two pages that are it — so leave the click to the
           browser and let the link be a link. */
        if (!hasStaticMarkup(view)) return;
        e.preventDefault();
        setUrl(a.getAttribute('href'));
        showStatic(view);
      });
    });
  }

  /* The poem title shows in the page header and, on narrow screens, in the bar. */
  function setPoemTitle(title) {
    var headerTitle = document.querySelector('.header .title');
    if (headerTitle) headerTitle.textContent = title;
    var barTitle = document.querySelector('.topbar-title');
    if (barTitle) barTitle.textContent = title;
  }

  function getPrevPoemId() {
    if (!window.POEM_IDS || !window.CURRENT_POEM_ID) return null;
    var i = window.POEM_IDS.indexOf(window.CURRENT_POEM_ID);
    return i > 0 ? window.POEM_IDS[i - 1] : null;
  }

  function getNextPoemId() {
    if (!window.POEM_IDS || !window.CURRENT_POEM_ID) return null;
    var i = window.POEM_IDS.indexOf(window.CURRENT_POEM_ID);
    return i >= 0 && i < window.POEM_IDS.length - 1 ? window.POEM_IDS[i + 1] : null;
  }

  /* A poem drawn at random, never the one already open: landing back on the
     same page reads as a button that did nothing. */
  function getRandomPoemId() {
    var ids = window.POEM_IDS;
    if (!ids || !ids.length) return null;
    if (ids.length === 1) return ids[0];
    var pick;
    do {
      pick = ids[Math.floor(Math.random() * ids.length)];
    } while (pick === window.CURRENT_POEM_ID);
    return pick;
  }

  function updatePoemNav() {
    setNavLink(document.querySelector('.poem-nav-prev'), getPrevPoemId());
    setNavLink(document.querySelector('.poem-nav-next'), getNextPoemId());
  }

  function setNavLink(a, id) {
    if (!a) return;
    var poem = poemMeta(id);
    if (poem) {
      a.href = poemHref(id);
      a.removeAttribute('aria-disabled');
    } else {
      a.removeAttribute('href');
      a.setAttribute('aria-disabled', 'true');
    }
    var title = a.querySelector('.poem-nav-title');
    if (title) title.textContent = poem ? poem.title : '';
  }

  function switchPoem(id, push) {
    if (!poemExists(id)) return;
    /* Known, but its verse has not arrived. Fetch it and come back — the page
       stays as it was meanwhile, which for a local file is a few milliseconds
       and, once corpus.js has finished its background pass, never happens at
       all. Two clicks on the same link share the one fetch. */
    if (window.CORPUS && !window.CORPUS.has(id)) {
      window.CORPUS.ensure(id).then(function () {
        switchPoem(id, push);
      }, function () { /* the poem stays where it was */ });
      return;
    }
    if (!window.POEMS || !window.POEMS[id]) return;
    window.CURRENT_POEM_ID = id;
    window.TRANSLATION_SEGMENTS = window.POEMS[id].segments;
    window.TRANSLATION_BLOCKS = window.POEMS[id].blocks;
    /* Only if the address does not already name this poem: edit mode
       re-switches to the poem already open after a save, and that must not
       leave a second copy of the same page in the history. */
    var here = currentRoute();
    if (push !== false && !(here.view === 'poem' && here.id === id)) setUrl(poemHref(id));
    closeDrawer();
    setView('poem');

    setPoemTitle(window.POEMS[id].title);
    var sidebarLinks = document.querySelectorAll('.sidebar a[data-poem-id]');
    sidebarLinks.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-poem-id') === id);
      a.setAttribute('aria-current', a.getAttribute('data-poem-id') === id ? 'true' : 'false');
    });

    updatePoemNav();
    revealActiveSection();

    var comparison = document.querySelector('.comparison');
    if (comparison) {
      comparison.innerHTML = '';
      buildComparison();
    }
    updateSources();
    updateMeta();

    // After switching poems via navigation, scroll viewport to top
    if (typeof window !== 'undefined' && window.scrollTo) {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }

  /* --- Sidebar title hover: show translated title --- */

  var canHover = !!(window.matchMedia && window.matchMedia('(hover: hover)').matches);

  function initSidebarTitleHover(a, id) {
    if (!canHover) return;
    /* Looked up on each hover rather than once here: the manifest answers
       before the poem's own file has arrived, and the file answers better
       once it has. */
    a.addEventListener('mouseenter', function () {
      var poem = poemMeta(id);
      if (!poem) return;
      var titles = poem.titles || {};
      a.textContent = titles[currentTranslationLang] || frTitleOf(poem);
    });
    a.addEventListener('mouseleave', function () {
      var poem = poemMeta(id);
      if (poem) a.textContent = frTitleOf(poem);
    });
  }

  function frTitleOf(poem) {
    return poem.title || (poem.titles && poem.titles.fr) || '';
  }

  function buildSourceCell(lang) {
    var wrap = document.createElement('div');
    wrap.className = 'column-source';
    var poem = window.POEMS && window.POEMS[window.CURRENT_POEM_ID];
    var src = poem && poem.sources;
    if (!src) return wrap;

    var text = lang === 'fr' ? src.fr : src[lang];
    var url = lang === 'fr' ? src.frUrl : src[lang + 'Url'];
    if (!text) return wrap;

    var label = document.createElement('span');
    label.className = 'column-source-label';
    label.textContent = lang === 'fr' ? 'Source' : 'Translation';
    wrap.appendChild(label);

    var body = document.createElement('span');
    body.className = 'column-source-text';
    if (url) {
      var a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = text;
      body.appendChild(a);
    } else {
      body.textContent = text;
    }
    wrap.appendChild(body);
    return wrap;
  }

  function updateSources() {
    /* sources now live at the foot of each column; the grid rebuild handles it */
  }

  var SIDEBAR_COLLAPSED_KEY = 'flowers-sidebar-collapsed';

  function getCollapsedSections() {
    try {
      var raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      return raw ? raw.split(',').filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function storeCollapsedSections(list) {
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, list.join(',')); } catch (e) {}
  }

  function setSectionCollapsed(wrap, collapsed, persist) {
    if (!wrap) return;
    var btn = wrap.querySelector('.sidebar-section-toggle');
    var section = btn && btn.getAttribute('data-section-toggle');
    wrap.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
    if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    if (!persist || !section) return;
    var list = getCollapsedSections().filter(function (s) { return s !== section; });
    if (collapsed) list.push(section);
    storeCollapsedSections(list);
  }

  function sectionWrapFor(section) {
    var ul = document.querySelector('.sidebar .poem-list[data-section="' + section + '"]');
    return ul && ul.closest ? ul.closest('.sidebar-section') : null;
  }

  /* keep the section holding the current poem open, and in view */
  function revealActiveSection() {
    var section = POEM_SECTIONS[window.CURRENT_POEM_ID];
    var wrap = section && sectionWrapFor(section);
    if (!wrap) return;
    if (wrap.getAttribute('data-collapsed') === 'true') setSectionCollapsed(wrap, false, true);
    var active = document.querySelector('.sidebar .poem-list a.active');
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  function initSectionToggles() {
    var collapsed = getCollapsedSections();
    var wraps = document.querySelectorAll('.sidebar .sidebar-section');
    wraps.forEach(function (wrap) {
      var btn = wrap.querySelector('.sidebar-section-toggle');
      if (!btn) return;
      var section = btn.getAttribute('data-section-toggle');
      var ul = wrap.querySelector('.poem-list');

      /* show how many poems each section holds */
      var count = wrap.querySelector('.sidebar-section-count');
      if (!count) {
        count = document.createElement('span');
        count.className = 'sidebar-section-count';
        btn.appendChild(count);
      }
      count.textContent = ul ? String(ul.children.length) : '';

      setSectionCollapsed(wrap, collapsed.indexOf(section) !== -1, false);

      if (btn.getAttribute('data-bound') === '1') return;
      btn.setAttribute('data-bound', '1');
      btn.addEventListener('click', function () {
        var isCollapsed = wrap.getAttribute('data-collapsed') === 'true';
        setSectionCollapsed(wrap, !isCollapsed, true);
      });
    });
    revealActiveSection();
  }

  function hideEmptySections() {
    var lists = document.querySelectorAll('.sidebar .poem-list[data-section]');
    lists.forEach(function (ul) {
      var wrap = ul.closest ? ul.closest('.sidebar-section') : null;
      if (wrap) wrap.hidden = ul.children.length === 0;
    });
  }

  /* The whole index of the site, built from the manifest. Only the root page
     ships these links in its markup now — writing all 133 into all 133 poem
     pages was 2.7 MB of the same list — so on every other page this is what
     puts them there. */
  function buildSidebar() {
    if (!window.POEM_IDS || !window.POEMS) return;
    var lists = document.querySelectorAll('.sidebar .poem-list[data-section]');
    if (!lists.length) return;

    var listsBySection = {};
    lists.forEach(function (ul) {
      var section = ul.getAttribute('data-section') || '';
      ul.innerHTML = '';
      if (section) listsBySection[section] = ul;
    });

    function appendToSection(section, li) {
      var target = listsBySection[section] || lists[0];
      if (target) target.appendChild(li);
    }

    window.POEM_IDS.forEach(function (id) {
      var meta = poemMeta(id);
      if (!meta) return;
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = poemHref(id);
      a.setAttribute('data-poem-id', id);
      a.textContent = frTitleOf(meta);
      a.classList.toggle('active', id === window.CURRENT_POEM_ID);
      if (id === window.CURRENT_POEM_ID) a.setAttribute('aria-current', 'true');
      a.addEventListener('click', function (e) {
        if (!isPlainClick(e)) return;
        e.preventDefault();
        switchPoem(id);
      });
      li.appendChild(a);
      initSidebarTitleHover(a, id);

      var section = POEM_SECTIONS[id] || 'spleen-et-ideal';
      appendToSection(section, li);
    });
  }

  function getPoemTitle(lang) {
    var poem = window.POEMS && window.POEMS[window.CURRENT_POEM_ID];
    if (!poem) return COLUMN_TITLES[lang] || lang;
    if (poem.titles && poem.titles[lang]) return poem.titles[lang];
    return poem.title || COLUMN_TITLES[lang] || lang;
  }

  function buildTranslationColumnHeader(translationLang) {
    var wrap = document.createElement('div');
    wrap.className = 'column-title column-title--translation';
    var titleText = document.createElement('span');
    titleText.className = 'column-title-text';
    titleText.textContent = getPoemTitle(translationLang);
    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'translation-dropdown-trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-label', 'Choose translation language');
    var langLabel = document.createElement('span');
    langLabel.className = 'translation-lang-label';
    langLabel.textContent = COLUMN_TITLES[translationLang] || translationLang;
    trigger.appendChild(langLabel);
    var chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '▼';
    trigger.appendChild(chevron);
    var panel = document.createElement('div');
    panel.className = 'translation-dropdown-panel';
    panel.setAttribute('role', 'listbox');
    panel.setAttribute('aria-hidden', 'true');
    wrap.appendChild(titleText);
    wrap.appendChild(trigger);
    wrap.appendChild(panel);
    return wrap;
  }

  function buildComparison() {
    var comparison = document.querySelector('.comparison');
    if (!comparison) return;
    var lps = comparison.getAttribute('data-lines-per-stanza');
    if (lps) LINES_PER_STANZA = parseInt(lps, 10);

    var translationLangs = availableTranslationLangs();
    var lang = preferredTranslationLang;
    if (translationLangs.indexOf(lang) === -1) lang = translationLangs[0];
    /* Scott translated 50 of these poems and Marquina 114, so most have only
       one of the two. Opening every poem in English would put a "no English
       translation yet" note where a Spanish one exists — and that note, not
       the verse, is what a search engine would take the page to be about. So
       fall back to a language the poem actually carries. The dropdown names
       whichever one that is, and still offers the empty one. */
    if (!poemHasLang(lang)) {
      for (var pick = 0; pick < translationLangs.length; pick++) {
        if (poemHasLang(translationLangs[pick])) { lang = translationLangs[pick]; break; }
      }
    }
    currentTranslationLang = lang;

    var langs = ['fr', lang];
    var blocksByLang = {};
    for (var l = 0; l < langs.length; l++) {
      var bl = renderPoem(langs[l]);
      if (!bl.length) return;
      blocksByLang[langs[l]] = bl;
    }

    /* A generated page ships the poem already written into this container, so
       that a crawler — or a reader whose JavaScript never arrives — sees the
       verse without running anything. Now that we have something to put in its
       place, it goes. */
    comparison.innerHTML = '';

    var numRows = blocksByLang[langs[0]].length + 2; /* header + stanzas + sources */
    var rowIndex = 0;

    function addRow(cellContents, extraClass) {
      rowIndex += 1;
      var isFirstRow = rowIndex === 1;
      var isLastRow = rowIndex === numRows;
      for (var c = 0; c < langs.length; c++) {
        var cell = document.createElement('div');
        cell.className = 'cell cell-' + langs[c];
        if (extraClass) cell.classList.add(extraClass);
        if (c === 1) cell.classList.add('cell-translation');
        cell.setAttribute('data-lang', langs[c]);
        if (isFirstRow) cell.classList.add('row-first');
        if (isLastRow) cell.classList.add('row-last');
        if (c === 0) cell.classList.add('column-left');
        if (c === langs.length - 1) cell.classList.add('column-right');
        cell.setAttribute('role', 'cell');
        cell.style.gridRow = String(rowIndex);
        cell.style.gridColumn = String(c + 1);
        var content = cellContents[c];
        if (typeof content === 'string') {
          cell.innerHTML = content;
        } else if (content && content.nodeType) {
          cell.appendChild(content);
        }
        comparison.appendChild(cell);
      }
    }

    var poem = window.POEMS && window.POEMS[window.CURRENT_POEM_ID];
    var frTitle = document.createElement('h2');
    frTitle.className = 'column-title';
    frTitle.textContent = COLUMN_TITLES.fr;
    frTitle.setAttribute('id', 'column-title-fr');

    var translationHeader = buildTranslationColumnHeader(lang);
    translationHeader.querySelector('.column-title-text').textContent = getPoemTitle(lang);
    addRow([frTitle, translationHeader]);

    var blockCount = blocksByLang[langs[0]].length;
    for (var i = 0; i < blockCount; i++) {
      if (blocksByLang[langs[0]][i].type === 'blank') {
        var blankRow = [];
        for (var b = 0; b < langs.length; b++) {
          var blankEl = document.createElement('div');
          blankEl.className = 'stanza-blank';
          blankEl.setAttribute('aria-hidden', 'true');
          blankRow.push(blankEl);
        }
        addRow(blankRow, 'cell-blank');
      } else if (blocksByLang[langs[0]][i].type === 'part') {
        var partRow = [];
        for (var pl = 0; pl < langs.length; pl++) {
          var partEl = document.createElement('div');
          partEl.className = 'stanza-part';
          partEl.textContent = blocksByLang[langs[0]][i].label || '';
          partRow.push(partEl);
        }
        addRow(partRow, 'cell-part');
      } else if (blocksByLang[langs[0]][i].type === 'stanza') {
        var stanzaRow = [];
        for (var s = 0; s < langs.length; s++) {
          var langCode = langs[s];
          var stanzaData = blocksByLang[langCode][i];
          var stanzaEl = document.createElement('div');
          stanzaEl.className = 'stanza' + (langCode === 'fr' ? ' stanza--numbered' : '');
          if (stanzaData && stanzaData.missing) stanzaEl.classList.add('stanza--missing');
          stanzaEl.innerHTML = stanzaData.type === 'stanza' && stanzaData.html ? stanzaData.html : '';
          stanzaRow.push(stanzaEl);
        }
        addRow(stanzaRow);
      }
    }
    addRow([buildSourceCell('fr'), buildSourceCell(lang)], 'cell-source');

    initTranslationDropdown(translationLangs);
  }

  function switchTranslationLang(newLang) {
    currentTranslationLang = newLang;
    preferredTranslationLang = newLang;
    var comparison = document.querySelector('.comparison');
    if (!comparison) return;
    /* the cell wears its language as a class; clear whichever one it had */
    var staleClasses = allTranslationLangs().map(function (l) { return 'cell-' + l; });
    var cells = comparison.querySelectorAll('.cell-translation:not(.cell-source)');
    var blocks = renderPoem(newLang);
    if (!blocks.length || blocks.length !== cells.length - 1) return;
    var header = comparison.querySelector('.column-title--translation');
    if (header) {
      var titleText = header.querySelector('.column-title-text');
      if (titleText) titleText.textContent = getPoemTitle(newLang);
      var langLabel = header.querySelector('.translation-lang-label');
      if (langLabel) langLabel.textContent = COLUMN_TITLES[newLang] || newLang;
    }
    var srcCell = comparison.querySelector('.cell-source.cell-translation');
    if (srcCell) {
      srcCell.classList.remove.apply(srcCell.classList, staleClasses);
      srcCell.classList.add('cell-' + newLang);
      srcCell.setAttribute('data-lang', newLang);
      srcCell.innerHTML = '';
      srcCell.appendChild(buildSourceCell(newLang));
    }

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      cell.classList.remove.apply(cell.classList, staleClasses);
      cell.classList.add('cell-' + newLang);
      cell.setAttribute('data-lang', newLang);
      if (i === 0) continue;
      var block = blocks[i - 1];
      if (block.type === 'blank') {
        cell.innerHTML = '';
      } else if (block.type === 'stanza') {
        /* rebuild unconditionally: an empty stanza is what a poem with no
           public-domain translation looks like, and it must clear the
           previous language's verse rather than leave it stranded */
        var stanzaEl = document.createElement('div');
        stanzaEl.className = 'stanza' + (block.missing ? ' stanza--missing' : '');
        stanzaEl.innerHTML = block.html || '';
        cell.innerHTML = '';
        cell.appendChild(stanzaEl);
      }
    }

    if (syncDemoLang) syncDemoLang(newLang);
  }

  /* Bound once rather than per rebuild. `buildComparison()` runs on every poem
     switch, and a fresh dismiss listener each time would pile up — each closed
     over a header that had since been thrown away. So this one looks the open
     dropdown up at click time instead of capturing it. */
  var dropdownDismissBound = false;

  function closeTranslationDropdown() {
    var header = document.querySelector('.column-title--translation.dropdown-open');
    if (!header) return;
    header.classList.remove('dropdown-open');
    var trigger = header.querySelector('.translation-dropdown-trigger');
    var panel = header.querySelector('.translation-dropdown-panel');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (panel) panel.setAttribute('aria-hidden', 'true');
  }

  function initTranslationDropdown(translationLangs) {
    var header = document.querySelector('.column-title--translation');
    if (!header) return;
    var trigger = header.querySelector('.translation-dropdown-trigger');
    var panel = header.querySelector('.translation-dropdown-panel');
    var titleText = header.querySelector('.column-title-text');
    if (!trigger || !panel) return;

    panel.innerHTML = '';
    translationLangs.forEach(function (langCode) {
      var opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'translation-dropdown-option';
      opt.setAttribute('role', 'option');
      opt.textContent = COLUMN_TITLES[langCode] || langCode;
      opt.setAttribute('data-lang', langCode);
      if (langCode === currentTranslationLang) opt.setAttribute('aria-selected', 'true');
      opt.addEventListener('click', function () {
        var lang = this.getAttribute('data-lang');
        if (lang === currentTranslationLang) { closeDropdown(); return; }
        switchTranslationLang(lang);
        panel.querySelectorAll('[role="option"]').forEach(function (o) {
          o.setAttribute('aria-selected', o.getAttribute('data-lang') === lang ? 'true' : 'false');
        });
        closeDropdown();
      });
      panel.appendChild(opt);
    });

    function openDropdown() {
      panel.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
      header.classList.add('dropdown-open');
    }
    function closeDropdown() {
      closeTranslationDropdown();
    }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = trigger.getAttribute('aria-expanded') === 'true';
      if (isOpen) closeDropdown();
      else openDropdown();
    });

    if (!dropdownDismissBound) {
      dropdownDismissBound = true;
      document.addEventListener('click', closeTranslationDropdown);
    }
    panel.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  /* --- Home page extract ---------------------------------------------------
     The home page carries a live four-line extract, so the three gestures the
     reader is made of — hovering a line, hovering a word, changing the
     translation — can be tried before a poem has been chosen. It is built from
     the poem's own file rather than copied into the markup, so it shows the
     same text, and behaves the same way, as the reader below it.

     Its tids and wids are prefixed: reader and extract share one document, and
     a highlight in one must not reach into the other. */

  var DEMO_PREFIX = 'demo-';
  var DEMO_LANG_NAMES = { en: 'English', es: 'Español' };

  /* Points the extract at a language; set by buildDemo, called from
     switchTranslationLang so the extract and the reader never disagree. */
  var syncDemoLang = null;

  /* Re-labels the extract's own chrome when the page language changes. */
  var syncDemoUiLang = null;

  function demoSegments(poem, from, count) {
    return poem.segments.slice(from, from + count).map(function (seg) {
      var copy = { id: DEMO_PREFIX + seg.id, fr: seg.fr, en: seg.en, es: seg.es };
      if (seg.wordGroups) {
        copy.wordGroups = seg.wordGroups.map(function (group) {
          return { wid: DEMO_PREFIX + group.wid, fr: group.fr, en: group.en, es: group.es };
        });
      }
      return copy;
    });
  }

  function demoSegmentHtml(lang, seg) {
    return '<span class="translation-segment" data-tid="' + seg.id + '">' +
      renderWordGroupContent(lang, seg) + '</span>';
  }

  function demoCell(lang, seg, extraClass) {
    var cell = document.createElement('span');
    cell.className = 'demo-cell ' + extraClass;
    cell.setAttribute('data-lang', lang);
    cell.innerHTML = demoSegmentHtml(lang, seg);
    return cell;
  }

  function buildDemo() {
    var el = document.querySelector('.demo');
    if (!el) return;
    var id = el.getAttribute('data-demo-poem');
    var poem = window.POEMS && window.POEMS[id];
    if (!poem || !poem.segments) return;

    var from = parseInt(el.getAttribute('data-demo-from'), 10) || 0;
    var count = parseInt(el.getAttribute('data-demo-lines'), 10) || 4;
    var segments = demoSegments(poem, from, count);
    if (!segments.length) return;
    /* every line of the extract must carry the language: a column that ran out
       halfway would break the pairing exactly where it is being demonstrated */
    var langs = ['en', 'es'].filter(function (code) {
      return segments.every(function (seg) { return seg[code]; });
    });
    if (!langs.length) return;
    var lang = langs.indexOf(currentTranslationLang) !== -1 ? currentTranslationLang : langs[0];

    var card = document.createElement('div');
    card.className = 'demo-card';

    var head = document.createElement('div');
    head.className = 'demo-pair demo-head';
    var frHead = document.createElement('span');
    frHead.className = 'demo-cell demo-head-cell';
    frHead.textContent = poem.title;
    var trHead = document.createElement('span');
    trHead.className = 'demo-cell demo-head-cell demo-head-cell--translation';
    var trTitle = document.createElement('span');
    trTitle.className = 'demo-head-title';
    trHead.appendChild(trTitle);

    var switcher = document.createElement('span');
    switcher.className = 'demo-langs';
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', t('demoLangs'));
    var buttons = langs.map(function (code) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'demo-lang';
      button.setAttribute('data-lang', code);
      button.textContent = DEMO_LANG_NAMES[code] || code;
      button.addEventListener('click', function () { setDemoLang(code); });
      switcher.appendChild(button);
      return button;
    });
    trHead.appendChild(switcher);
    head.appendChild(frHead);
    head.appendChild(trHead);
    card.appendChild(head);

    var rows = segments.map(function (seg) {
      var pair = document.createElement('div');
      pair.className = 'demo-pair';
      pair.appendChild(demoCell('fr', seg, 'demo-cell-fr'));
      var translation = demoCell(lang, seg, 'demo-cell-translation');
      pair.appendChild(translation);
      card.appendChild(pair);
      return { seg: seg, cell: translation };
    });

    var caption = document.createElement('figcaption');
    caption.className = 'demo-caption';
    var open = document.createElement('button');
    open.type = 'button';
    open.className = 'demo-open';
    open.addEventListener('click', function () { switchPoem(id); });
    caption.appendChild(open);

    /* The two strings the extract writes itself, in the page's language. */
    function applyDemoUiLang() {
      open.textContent = t('demoOpen').replace('%s', poem.title);
      switcher.setAttribute('aria-label', t('demoLangs'));
    }
    applyDemoUiLang();

    function applyDemoLang(next) {
      lang = next;
      trTitle.textContent = (poem.titles && poem.titles[next]) || poem.title;
      rows.forEach(function (row) {
        row.cell.setAttribute('data-lang', next);
        row.cell.innerHTML = demoSegmentHtml(next, row.seg);
      });
      buttons.forEach(function (button) {
        button.setAttribute('aria-pressed', button.getAttribute('data-lang') === next ? 'true' : 'false');
      });
    }

    /* Picking a language here also points the reader at it, so the poem opens
       in the language the extract was left in. */
    function setDemoLang(next) {
      if (next === lang) return;
      applyDemoLang(next);
      setTranslationLang(next);
    }

    el.innerHTML = '';
    el.appendChild(card);
    el.appendChild(caption);
    applyDemoLang(lang);

    delegateHover(el);
    delegateWiktionaryClick(el);
    syncDemoLang = function (next) {
      /* the extract has one button per plain language, so a Bravo translation
         shows under the language it is a translation into */
      if (window.BRAVO) next = window.BRAVO.base(next);
      if (next !== lang && langs.indexOf(next) !== -1) applyDemoLang(next);
    };
    syncDemoUiLang = applyDemoUiLang;
  }

  function getAllSegmentSpans() {
    return document.querySelectorAll('.translation-segment[data-tid]');
  }

  function getTidsFromSelection() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return [];

    var tids = [];
    var spans = getAllSegmentSpans();
    for (var r = 0; r < sel.rangeCount; r++) {
      var range = sel.getRangeAt(r);
      for (var i = 0; i < spans.length; i++) {
        var span = spans[i];
        if (range.intersectsNode(span)) tids.push(span.getAttribute('data-tid'));
      }
    }
    return tids.filter(function (id, i) { return tids.indexOf(id) === i; });
  }

  function highlightByTids(tids, useSelectionClass) {
    var cls = useSelectionClass ? HIGHLIGHT_SELECTION_CLASS : HIGHLIGHT_CLASS;
    var spans = getAllSegmentSpans();
    spans.forEach(function (span) {
      if (tids.indexOf(span.getAttribute('data-tid')) !== -1) {
        span.classList.add(cls);
      } else {
        span.classList.remove(cls);
      }
    });
  }

  function clearHighlight(useSelectionClass) {
    var cls = useSelectionClass ? HIGHLIGHT_SELECTION_CLASS : HIGHLIGHT_CLASS;
    document.querySelectorAll('.' + cls).forEach(function (el) { el.classList.remove(cls); });
  }

  function highlightWordGroup(wid) {
    document.querySelectorAll('.word-group[data-wid="' + wid + '"]').forEach(function (el) {
      el.classList.add(WORD_HIGHLIGHT_CLASS);
    });
  }

  function clearWordHighlight() {
    document.querySelectorAll('.' + WORD_HIGHLIGHT_CLASS).forEach(function (el) {
      el.classList.remove(WORD_HIGHLIGHT_CLASS);
    });
  }

  function onHoverEnter(span) {
    var tid = span.getAttribute('data-tid');
    if (tid != null) highlightByTids([tid], false);
  }

  function onHoverLeave() {
    clearHighlight(false);
  }

  function onSelectionChange() {
    clearWordHighlight();
    var tids = getTidsFromSelection();
    if (tids.length) {
      highlightByTids(tids, true);
    } else {
      clearHighlight(true);
    }
  }

  function delegateHover(container) {
    container.addEventListener('mouseover', function (e) {
      var seg = e.target.closest('.translation-segment[data-tid]');
      if (seg) onHoverEnter(seg);

      clearWordHighlight();
      var wordGroup = e.target.closest('.word-group[data-wid]');
      if (wordGroup) {
        highlightWordGroup(wordGroup.getAttribute('data-wid'));
      }
    });
    container.addEventListener('mouseout', function (e) {
      var related = e.relatedTarget;
      var enteringSegment = related && related.closest && related.closest('.translation-segment[data-tid]');
      if (!enteringSegment) {
        onHoverLeave();
        clearWordHighlight();
      }
      var enteringWordGroup = related && related.closest && related.closest('.word-group[data-wid]');
      if (!enteringWordGroup) {
        clearWordHighlight();
      }
    });
  }

  function delegateSelection(container) {
    container.addEventListener('mouseup', function () {
      setTimeout(onSelectionChange, 0);
    });
    document.addEventListener('selectionchange', function () {
      setTimeout(onSelectionChange, 0);
    });
  }

  var SIDEBAR_HIDDEN_KEY = 'flowers-sidebar-hidden';
  var FONT_SIZE_KEY = 'flowers-font-size';
  var THEME_KEY = 'flowers-theme';
  /* Percentages of the base size: 100% (the default, and the floor) up to 200%. */
  var FONT_SIZES = ['100', '120', '140', '160', '180', '200'];
  var FONT_SIZE_DEFAULT = '100';
  /* Sizes stored by the older s/m/l scale, whose 'm' was the default. */
  var FONT_SIZE_LEGACY = { s: '100', m: '100', l: '120' };

  /* Below this width the sidebar stops being a rail beside the page and becomes
     a drawer over it, opened from the top bar. The two states stay separate:
     `sidebar-hidden` is the remembered rail preference, `sidebar-open` is the
     drawer, which always starts closed however the rail was left. */
  var drawerMedia = window.matchMedia ? window.matchMedia('(max-width: 900px)') : null;

  function isDrawer() {
    return !!drawerMedia && drawerMedia.matches;
  }

  function storedSidebarHidden() {
    try { return !!localStorage.getItem(SIDEBAR_HIDDEN_KEY); } catch (e) { return false; }
  }

  function setSidebarHidden(hidden) {
    document.body.classList.toggle('sidebar-hidden', hidden);
    try { localStorage.setItem(SIDEBAR_HIDDEN_KEY, hidden ? '1' : ''); } catch (e) {}
  }

  function isDrawerOpen() {
    return document.body.classList.contains('sidebar-open');
  }

  function setDrawerOpen(open) {
    document.body.classList.toggle('sidebar-open', open);
    var menu = document.querySelector('.topbar-menu');
    if (menu) menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      var close = document.querySelector('.sidebar-close');
      if (close && close.focus) close.focus();
    }
  }

  function closeDrawer() {
    if (isDrawerOpen()) setDrawerOpen(false);
  }

  /* Keep exactly one of the two states live for the current width. */
  function syncSidebarMode() {
    if (isDrawer()) {
      document.body.classList.remove('sidebar-hidden');
    } else {
      setDrawerOpen(false);
      document.body.classList.toggle('sidebar-hidden', storedSidebarHidden());
    }
  }

  function getStoredFontSize() {
    try {
      var s = localStorage.getItem(FONT_SIZE_KEY);
      if (FONT_SIZES.indexOf(s) >= 0) return s;
      return FONT_SIZE_LEGACY[s] || FONT_SIZE_DEFAULT;
    } catch (e) { return FONT_SIZE_DEFAULT; }
  }

  function setFontSize(size) {
    if (FONT_SIZES.indexOf(size) < 0) return;
    document.documentElement.setAttribute('data-font-size', size);
    try { localStorage.setItem(FONT_SIZE_KEY, size); } catch (e) {}
    syncFontButtons();
  }

  /* Grey out whichever of A- / A+ has nowhere left to go. */
  function syncFontButtons() {
    var i = FONT_SIZES.indexOf(getStoredFontSize());
    var down = document.querySelector('.sidebar-control.font-down');
    var up = document.querySelector('.sidebar-control.font-up');
    if (down) down.disabled = i <= 0;
    if (up) up.disabled = i >= FONT_SIZES.length - 1;
  }

  function getStoredTheme() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      return t === 'dark' ? 'dark' : 'light';
    } catch (e) { return 'light'; }
  }

  function setTheme(theme) {
    var isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
    try { localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light'); } catch (e) {}
  }

  function initSidebarControls() {
    var fontDown = document.querySelector('.sidebar-control.font-down');
    var fontUp = document.querySelector('.sidebar-control.font-up');
    var themeBtn = document.querySelector('.sidebar-control.theme-toggle');
    setFontSize(getStoredFontSize());
    setTheme(getStoredTheme());
    if (fontDown) fontDown.addEventListener('click', function () {
      var cur = getStoredFontSize();
      var i = FONT_SIZES.indexOf(cur);
      if (i > 0) setFontSize(FONT_SIZES[i - 1]);
    });
    if (fontUp) fontUp.addEventListener('click', function () {
      var cur = getStoredFontSize();
      var i = FONT_SIZES.indexOf(cur);
      if (i >= 0 && i < FONT_SIZES.length - 1) setFontSize(FONT_SIZES[i + 1]);
    });
    if (themeBtn) themeBtn.addEventListener('click', function () {
      var next = getStoredTheme() === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  }

  function initSidebarToggle() {
    var toggle = document.querySelector('.sidebar-toggle');
    var show = document.querySelector('.sidebar-show');
    var menu = document.querySelector('.topbar-menu');
    var close = document.querySelector('.sidebar-close');
    var scrim = document.querySelector('.sidebar-scrim');

    syncSidebarMode();

    if (toggle) toggle.addEventListener('click', function () {
      if (isDrawer()) setDrawerOpen(false);
      else setSidebarHidden(true);
    });
    if (show) show.addEventListener('click', function () { setSidebarHidden(false); });
    if (menu) menu.addEventListener('click', function () { setDrawerOpen(!isDrawerOpen()); });
    if (close) close.addEventListener('click', function () {
      setDrawerOpen(false);
      if (menu && menu.focus) menu.focus();
    });
    if (scrim) scrim.addEventListener('click', function () { setDrawerOpen(false); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isDrawerOpen()) {
        setDrawerOpen(false);
        if (menu && menu.focus) menu.focus();
      }
    });

    if (drawerMedia) {
      if (drawerMedia.addEventListener) drawerMedia.addEventListener('change', syncSidebarMode);
      else if (drawerMedia.addListener) drawerMedia.addListener(syncSidebarMode);
    }
    /* resize is the belt to that braces: a rotation or a dragged window edge
       always reports here, even where the media query list stays quiet */
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        resizeTimer = null;
        syncSidebarMode();
      }, 120);
    });
  }

  /* The bar repeats the poem title, but only once the page header has scrolled
     out of sight -- otherwise it just says the same thing twice. */
  function initTopbarTitle() {
    var bar = document.querySelector('.topbar');
    var anchor = document.querySelector('.header .title');
    if (!bar || !anchor) return;
    if (!window.IntersectionObserver) {
      bar.classList.add('is-scrolled');
      return;
    }
    new window.IntersectionObserver(function (entries) {
      bar.classList.toggle('is-scrolled', !entries[0].isIntersecting);
    }, { rootMargin: '-48px 0px 0px 0px' }).observe(anchor);
  }

  function initPoemNav() {
    bindNavLink(document.querySelector('.poem-nav-prev'), getPrevPoemId);
    bindNavLink(document.querySelector('.poem-nav-next'), getNextPoemId);
    updatePoemNav();
  }

  function bindNavLink(a, pick) {
    if (!a) return;
    a.addEventListener('click', function (e) {
      var id = pick();
      if (!id) { e.preventDefault(); return; }
      if (!isPlainClick(e)) return;
      e.preventDefault();
      switchPoem(id);
    });
  }

  /* --- Page language ------------------------------------------------------
     site-lang.js resolves and stores the language; the DOM side of it lives
     here with the rest of the UI. Both written pages carry the same toggle, so
     both are kept in step, and choosing a language points the translation
     column at it too -- a reader asking for the Spanish page is not asking to
     read Baudelaire beside English. The dropdown is free to disagree
     afterwards: it changes the column, never the page. */

  function syncLangToggles(lang) {
    document.querySelectorAll('.static-lang').forEach(function (button) {
      button.setAttribute('aria-pressed', button.getAttribute('data-lang') === lang ? 'true' : 'false');
    });
  }

  function initLangToggles() {
    if (!window.SITE_LANG) return;
    document.querySelectorAll('.static-lang').forEach(function (button) {
      button.addEventListener('click', function () {
        window.SITE_LANG.set(this.getAttribute('data-lang'));
      });
    });
    syncLangToggles(siteLang());

    window.SITE_LANG.onChange(function (lang) {
      syncLangToggles(lang);
      if (getView() !== 'poem') setPoemTitle(staticTitle(getView()));
      if (syncDemoUiLang) syncDemoUiLang();
      setTranslationLang(lang);
    });
  }

  /* --- Glossary popovers ---------------------------------------------------
     A term in the written pages that wants a sentence behind it carries the
     note as its next sibling: the term is a `popovertarget` button, so the
     browser owns the toggle, Escape and click-away. What it does not own is
     where the note lands — a popover is in the top layer, centred, until it is
     told otherwise — so it is placed under its own term here, flipped above
     when there is no room below, and kept there while it is up. */

  function initGlossary() {
    var terms = document.querySelectorAll('.glossary-term[popovertarget]');
    /* Without popover support the note stays hidden and the term is inert; the
       sentence it explains reads whole without it. */
    if (!terms.length || typeof document.body.showPopover !== 'function') return;

    terms.forEach(function (term) {
      var note = document.getElementById(term.getAttribute('popovertarget'));
      if (!note) return;
      term.setAttribute('aria-expanded', 'false');

      function place() {
        var rect = term.getBoundingClientRect();
        var edge = 8;
        var width = note.offsetWidth;
        var height = note.offsetHeight;

        var left = rect.left + rect.width / 2 - width / 2;
        left = Math.max(edge, Math.min(left, window.innerWidth - width - edge));

        var top = rect.bottom + edge;
        if (top + height > window.innerHeight - edge) {
          var above = rect.top - height - edge;
          top = above > edge ? above : Math.max(edge, window.innerHeight - height - edge);
        }

        note.style.left = Math.round(left) + 'px';
        note.style.top = Math.round(top) + 'px';
      }

      note.addEventListener('toggle', function (event) {
        var open = event.newState === 'open';
        term.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
          place();
          /* capture, so scrolling any ancestor moves the note with the term */
          window.addEventListener('scroll', place, true);
          window.addEventListener('resize', place);
        } else {
          window.removeEventListener('scroll', place, true);
          window.removeEventListener('resize', place);
        }
      });
    });
  }

  /* --- Privacy notice ------------------------------------------------------
     No cookies and nothing collected, so the bar states the position rather
     than asking to consent to it. Dismissing is remembered the same way every
     other preference is: one key, in this browser, on this device. */

  var PRIVACY_ACK_KEY = 'flowers-privacy-ack';

  function initPrivacyNotice() {
    var bar = document.querySelector('.privacy-bar');
    if (!bar) return;
    var acknowledged = false;
    try { acknowledged = !!localStorage.getItem(PRIVACY_ACK_KEY); } catch (e) {}
    /* The markup ships `hidden`, so a returning reader never sees it flash. */
    if (acknowledged) return;

    bar.hidden = false;
    document.body.classList.add('privacy-bar-open');

    /* The bar is fixed to the foot of the window and wraps to three lines on a
       phone, so the page is given exactly its height to clear rather than a
       guess that would leave the footer underneath it. */
    function fitPage() {
      document.documentElement.style.setProperty('--privacy-bar-h', bar.offsetHeight + 'px');
    }
    fitPage();
    window.addEventListener('resize', fitPage);

    function dismiss() {
      bar.hidden = true;
      document.body.classList.remove('privacy-bar-open');
      window.removeEventListener('resize', fitPage);
      document.documentElement.style.removeProperty('--privacy-bar-h');
      try { localStorage.setItem(PRIVACY_ACK_KEY, '1'); } catch (e) {}
    }

    var ok = bar.querySelector('.privacy-ok');
    if (ok) ok.addEventListener('click', dismiss);
    /* Reading the full statement counts as having seen the short one. */
    var details = bar.querySelector('.privacy-link');
    if (details) details.addEventListener('click', dismiss);
  }

  /* --- Hooks for search.js --- */

  var SEARCH_FLASH_CLASS = 'translation-search-flash';
  var searchFlashTimer = null;

  /* Point the translation column at `lang`, as picking it in the dropdown would. */
  function setTranslationLang(lang) {
    if (!lang) return;
    var comparison = document.querySelector('.comparison');
    if (!comparison) return;
    if (availableTranslationLangs().indexOf(lang) === -1) return;

    /* Asking for the language already on screen is still the reader stating a
       preference — it may be the one this poem fell back to — so record it
       before deciding there is nothing to redraw. */
    preferredTranslationLang = lang;
    if (lang === currentTranslationLang) return;

    switchTranslationLang(lang);
    var panel = document.querySelector('.translation-dropdown-panel');
    if (panel) {
      panel.querySelectorAll('[role="option"]').forEach(function (o) {
        o.setAttribute('aria-selected', o.getAttribute('data-lang') === lang ? 'true' : 'false');
      });
    }
  }

  /* Bring one line into view in every column and flash it, so a search hit is
     findable in the page it was opened from. */
  function focusLine(tid) {
    closeDrawer();
    var spans = document.querySelectorAll('.translation-segment[data-tid="' + tid + '"]');
    if (!spans.length) return;

    if (searchFlashTimer) window.clearTimeout(searchFlashTimer);
    document.querySelectorAll('.' + SEARCH_FLASH_CLASS).forEach(function (el) {
      el.classList.remove(SEARCH_FLASH_CLASS);
    });
    spans.forEach(function (el) { el.classList.add(SEARCH_FLASH_CLASS); });

    if (spans[0].scrollIntoView) {
      spans[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    searchFlashTimer = window.setTimeout(function () {
      searchFlashTimer = null;
      spans.forEach(function (el) { el.classList.remove(SEARCH_FLASH_CLASS); });
    }, 2600);
  }

  /* Tear the grid down and build it again from whatever `window.POEMS` now
     says. Edit mode needs this after a save; nothing else does, since the
     reader's own transitions all go through `switchPoem`. */
  function rebuildComparison() {
    var comparison = document.querySelector('.comparison');
    if (!comparison) return;
    comparison.innerHTML = '';
    buildComparison();
  }

  window.FLOWERS = {
    switchPoem: switchPoem,
    closeSidebar: closeDrawer,
    setTranslationLang: setTranslationLang,
    getTranslationLang: function () { return currentTranslationLang; },
    getPoemId: function () { return window.CURRENT_POEM_ID; },
    getPoem: function () { return (window.POEMS || {})[window.CURRENT_POEM_ID] || null; },
    availableTranslationLangs: availableTranslationLangs,
    rebuild: rebuildComparison,
    setPoemTitle: setPoemTitle,
    focusLine: focusLine
  };

  /* --- Wiktionary lookup --- */

  var WIKT_LANG_NAMES = { fr: 'French', en: 'English', es: 'Spanish' };

  function wiktionaryUrl(lang, word) {
    return 'https://' + lang + '.wiktionary.org/wiki/' + encodeURIComponent(word);
  }

  function wiktionaryApiUrl(lang, word) {
    return 'https://' + lang + '.wiktionary.org/w/api.php'
      + '?action=parse&page=' + encodeURIComponent(word)
      + '&prop=text&format=json&origin=*';
  }

  function createWiktionaryPanel() {
    var overlay = document.createElement('div');
    overlay.className = 'wiktionary-overlay';

    var panel = document.createElement('div');
    panel.className = 'wiktionary-panel';

    var header = document.createElement('div');
    header.className = 'wiktionary-header';

    var title = document.createElement('h3');
    title.className = 'wiktionary-title';

    var langLabel = document.createElement('span');
    langLabel.className = 'wiktionary-lang';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'wiktionary-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '\u00d7';

    header.appendChild(title);
    header.appendChild(langLabel);
    header.appendChild(closeBtn);

    var body = document.createElement('div');
    body.className = 'wiktionary-body';

    panel.appendChild(header);
    panel.appendChild(body);
    overlay.appendChild(panel);

    closeBtn.addEventListener('click', function () { closeWiktionaryPanel(overlay); });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeWiktionaryPanel(overlay);
    });

    return { overlay: overlay, title: title, langLabel: langLabel, body: body };
  }

  function closeWiktionaryPanel(overlay) {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.body.classList.remove('modal-open');
  }

  function openWiktionary(word, lang) {
    var existing = document.querySelector('.wiktionary-overlay');
    if (existing) existing.parentNode.removeChild(existing);

    var ui = createWiktionaryPanel();
    ui.title.textContent = word;
    ui.langLabel.textContent = WIKT_LANG_NAMES[lang] || lang;
    ui.body.innerHTML = '<div class="wiktionary-loading">Loading\u2026</div>';
    document.body.appendChild(ui.overlay);
    document.body.classList.add('modal-open');

    // Close on Escape
    var onKey = function (e) {
      if (e.key === 'Escape') {
        closeWiktionaryPanel(ui.overlay);
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);

    fetch(wiktionaryApiUrl(lang, word))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          ui.body.innerHTML = '<div class="wiktionary-error">No entry found for \u201c' + escapeHtml(word) + '\u201d'
            + '<br><a class="wiktionary-link" href="' + wiktionaryUrl(lang, word) + '" target="_blank" rel="noopener">Search on Wiktionary \u2192</a></div>';
          return;
        }
        var html = data.parse && data.parse.text && data.parse.text['*'];
        if (!html) {
          ui.body.innerHTML = '<div class="wiktionary-error">Could not load definition.</div>';
          return;
        }
        ui.body.innerHTML = html
          + '<a class="wiktionary-link" href="' + wiktionaryUrl(lang, word) + '" target="_blank" rel="noopener">View on Wiktionary \u2192</a>';
        // Rewrite relative links to point to Wiktionary
        var base = 'https://' + lang + '.wiktionary.org';
        ui.body.querySelectorAll('a[href]').forEach(function (a) {
          var href = a.getAttribute('href');
          if (href && href.charAt(0) === '/') a.setAttribute('href', base + href);
          if (!a.classList.contains('wiktionary-link')) {
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener');
          }
        });
        // Rewrite relative image srcs
        ui.body.querySelectorAll('img[src]').forEach(function (img) {
          var src = img.getAttribute('src');
          if (src && src.charAt(0) === '/') img.setAttribute('src', base + src);
        });
      })
      .catch(function () {
        ui.body.innerHTML = '<div class="wiktionary-error">Network error.'
          + '<br><a class="wiktionary-link" href="' + wiktionaryUrl(lang, word) + '" target="_blank" rel="noopener">Open Wiktionary directly \u2192</a></div>';
      });
  }

  function getWordAtClick(e) {
    var range;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (document.caretPositionFromPoint) {
      var pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos && pos.offsetNode) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.setEnd(pos.offsetNode, pos.offset);
      }
    }
    if (!range || !range.startContainer || range.startContainer.nodeType !== 3) return null;
    var text = range.startContainer.textContent;
    var offset = range.startOffset;
    // Find word boundaries around the offset
    var start = offset;
    var end = offset;
    var wordChars = /[^\s.,;:!?»«"'"\u201c\u201d\u00ab\u00bb]/;
    while (start > 0 && wordChars.test(text[start - 1])) start--;
    while (end < text.length && wordChars.test(text[end])) end++;
    if (start === end) return null;
    return text.substring(start, end);
  }

  function delegateWiktionaryClick(container) {
    container.addEventListener('click', function (e) {
      var wordGroup = e.target.closest('.word-group[data-wid]');
      if (!wordGroup) return;
      var cell = e.target.closest('[data-lang]');
      var lang = cell ? cell.getAttribute('data-lang') : 'fr';
      var word = getWordAtClick(e);
      if (!word) {
        // Fallback: use full word-group text
        word = wordGroup.textContent.trim();
        word = word.replace(/[.,;:!?»"'\u201d\u00bb]+$/, '').replace(/^[«"'\u201c\u00ab]+/, '');
      }
      if (word) openWiktionary(word, lang);
    });
  }

  function init() {
    /* A page with no verse on it is now an ordinary case — /about/ loads no
       poem at all — so having a corpus to work from is the test, not having a
       poem already open. Everything below that reads the current poem copes
       with there not being one; buildComparison() simply builds nothing. */
    var haveCorpus = !!(window.POEM_INDEX && Object.keys(window.POEM_INDEX).length);
    var haveVerse = !!(window.TRANSLATION_SEGMENTS && window.TRANSLATION_SEGMENTS.length);
    if (!haveCorpus && !haveVerse) return;

    /* A first visit opens in the translation that matches the page language;
       the dropdown overrides it from there. */
    currentTranslationLang = preferredTranslationLang = siteLang() === 'es' ? 'es' : 'en';

    initSidebarToggle();
    initSidebarControls();
    initTopbarTitle();

    if (window.POEMS && window.POEM_IDS && window.POEM_IDS.length) {
      applyInitialRoute();
      buildSidebar();
      hideEmptySections();
      initSectionToggles();
      initPoemNav();
    }

    buildComparison();
    updateSources();
    buildDemo();

    var comparison = document.querySelector('.comparison');
    if (comparison) {
      delegateHover(comparison);
      delegateSelection(comparison);
      delegateWiktionaryClick(comparison);
    }

    var current = poemMeta(window.CURRENT_POEM_ID);
    if (current) setPoemTitle(frTitleOf(current));

    initLangToggles();
    initGlossary();
    initPrivacyNotice();
    initRoutes();
    applyRoute(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
