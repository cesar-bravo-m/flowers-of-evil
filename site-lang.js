/* Site language -------------------------------------------------------------
   The two written pages -- home and about -- are carried in both English and
   Spanish, and `data-lang` on <body> says which of the two the stylesheet
   reveals. This file runs as the first thing inside <body>, before those pages
   are parsed, so a Spanish reader never sees the English copy blink past.

   The language is resolved once and then remembered. The browser's own
   language list decides where it says anything useful; where it is silent the
   time zone stands in for the region, since a browser left on English in
   Bogotá still reads Spanish. Whatever comes out is written to localStorage,
   so a reload shows the page as it was left rather than resolving it again --
   and a reader who picks the other language keeps that choice.

   Nothing here leaves the browser: no cookie, no request, no identifier. The
   stored value is a two-letter code on the reader's own device. */
(function () {
  var KEY = 'flowers-lang';
  var LANGS = { en: 1, es: 1 };
  var DEFAULT_LANG = 'en';

  /* Zones of the Spanish-speaking world. A time zone is a coarse instrument --
     it says region, never language -- so it is only consulted after the
     browser's own preference has had its say. */
  var SPANISH_ZONES = {
    'Europe/Madrid': 1, 'Atlantic/Canary': 1, 'Africa/Ceuta': 1, 'Africa/Malabo': 1,
    'America/Mexico_City': 1, 'America/Cancun': 1, 'America/Merida': 1,
    'America/Monterrey': 1, 'America/Matamoros': 1, 'America/Chihuahua': 1,
    'America/Ciudad_Juarez': 1, 'America/Ojinaga': 1, 'America/Hermosillo': 1,
    'America/Mazatlan': 1, 'America/Bahia_Banderas': 1, 'America/Tijuana': 1,
    'America/Guatemala': 1, 'America/El_Salvador': 1, 'America/Tegucigalpa': 1,
    'America/Managua': 1, 'America/Costa_Rica': 1, 'America/Panama': 1,
    'America/Havana': 1, 'America/Santo_Domingo': 1, 'America/Puerto_Rico': 1,
    'America/Caracas': 1, 'America/Bogota': 1, 'America/Guayaquil': 1,
    'America/Lima': 1, 'America/La_Paz': 1, 'America/Asuncion': 1,
    'America/Santiago': 1, 'America/Punta_Arenas': 1, 'Pacific/Easter': 1,
    'America/Montevideo': 1
  };

  function fromStorage() {
    try {
      var v = localStorage.getItem(KEY);
      return LANGS[v] ? v : null;
    } catch (e) { return null; }
  }

  function store(lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) {}
  }

  function fromNavigator() {
    var nav = window.navigator;
    if (!nav) return null;
    var tags = nav.languages && nav.languages.length ? nav.languages : [nav.language];
    for (var i = 0; i < tags.length; i++) {
      var tag = (tags[i] || '').toLowerCase();
      if (!tag) continue;
      /* First tag that names a language we carry wins; anything else (fr, de,
         ...) is not a vote for Spanish, so English stays the fallback. */
      if (tag === 'es' || tag.indexOf('es-') === 0) return 'es';
      if (tag === 'en' || tag.indexOf('en-') === 0) return 'en';
    }
    return null;
  }

  function fromTimeZone() {
    var zone = '';
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) { return null; }
    if (!zone) return null;
    /* Argentina files every province under its own zone. */
    if (zone.indexOf('America/Argentina/') === 0) return 'es';
    return SPANISH_ZONES[zone] ? 'es' : null;
  }

  function resolve() {
    return fromStorage() || fromNavigator() || fromTimeZone() || DEFAULT_LANG;
  }

  var listeners = [];
  var current = resolve();

  function apply(lang) {
    if (document.body) document.body.setAttribute('data-lang', lang);
  }

  /* Remembered from the first visit on, so a reload never re-resolves. */
  store(current);
  apply(current);

  window.SITE_LANG = {
    get: function () { return current; },

    /* The one way the language changes: the toggle on either page. */
    set: function (lang) {
      if (!LANGS[lang] || lang === current) return current;
      current = lang;
      store(lang);
      apply(lang);
      for (var i = 0; i < listeners.length; i++) listeners[i](lang);
      return current;
    },

    onChange: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
    },

    /* Picks the value for the current language out of `{ en: ..., es: ... }`. */
    pick: function (strings) {
      if (!strings) return '';
      return strings[current] !== undefined ? strings[current] : strings[DEFAULT_LANG];
    }
  };
})();
