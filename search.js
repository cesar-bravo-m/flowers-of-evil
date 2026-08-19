/**
 * Unified search, no backend and no index files: every poem is already in
 * window.POEMS, so titles and lines are folded once (lowercased, accents and
 * curly punctuation stripped) and scanned in memory. Folding is what makes the
 * search language-agnostic -- "ame" finds "âme", "corazon" finds
 * "corazón", "coeur" finds "cœur", "l'homme" finds "l’homme".
 *
 * One query covers French, English and Spanish titles and lines at once. A poem
 * matches when every query term appears somewhere in it; the lines shown are
 * the ones carrying the terms, best first. Opening a hit switches poem, swaps
 * the translation column when the hit was in a translation, and flashes the
 * line. Open the palette with Ctrl/Cmd+K, "/", or the sidebar search button.
 */
(function () {
  'use strict';

  var LANGS = ['fr', 'en', 'es'];
  var LANG_LABELS = { fr: 'FR', en: 'EN', es: 'ES' };
  var MAX_POEMS = 20;             /* poems listed for one query */
  var LINES_COLLAPSED = 4;        /* lines shown per poem before "more" */
  var SNIPPET_MAX = 120;          /* chars of a line kept around the first hit */
  var COLUMN_LANGS = ['en', 'es']; /* langs that live in the translation column */

  /* --- Folding: one canonical form, so any spelling matches in any language --- */

  var COMBINING = /[\u0300-\u036f]/g;
  var NON_ASCII = /[^\x20-\x7e]/;
  var WORD_CHAR = /[a-z0-9']/;
  var FOLD = {
    '’': "'", '‘': "'", 'ʼ': "'",
    '“': '"', '”': '"', '«': '"', '»': '"',
    '—': '-', '–': '-',
    'œ': 'oe', 'æ': 'ae', 'ß': 'ss'
  };
  var FOLD_RE = new RegExp('[' + Object.keys(FOLD).join('') + ']', 'g');

  function foldSpecials(s) {
    return s.replace(FOLD_RE, function (ch) { return FOLD[ch]; });
  }

  function stripAccents(s) {
    return s.normalize ? s.normalize('NFD').replace(COMBINING, '') : s;
  }

  function fold(s) {
    var lower = String(s).toLowerCase();
    if (!NON_ASCII.test(lower)) return lower;   /* plain ASCII: nothing to fold */
    return foldSpecials(stripAccents(lower));
  }

  function foldChar(ch) {
    var lower = ch.toLowerCase();
    if (FOLD[lower] != null) return FOLD[lower];
    if (!NON_ASCII.test(lower)) return lower;
    return stripAccents(lower);
  }

  /**
   * Same output as fold(), plus map[i] = index in `s` of the character that
   * produced folded character i (with a trailing sentinel). Lets a match found
   * in folded text be pointed back at the original for highlighting. Only runs
   * for the handful of results on screen.
   */
  function foldWithMap(s) {
    var out = '';
    var map = [];
    for (var i = 0; i < s.length; i++) {
      var folded = foldChar(s.charAt(i));
      for (var j = 0; j < folded.length; j++) {
        out += folded.charAt(j);
        map.push(i);
      }
    }
    map.push(s.length);
    return { text: out, map: map };
  }

  /* --- Matching --- */

  function mergeRanges(ranges) {
    if (ranges.length < 2) return ranges;
    ranges.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var out = [ranges[0]];
    for (var i = 1; i < ranges.length; i++) {
      var last = out[out.length - 1];
      if (ranges[i][0] <= last[1]) {
        if (ranges[i][1] > last[1]) last[1] = ranges[i][1];
      } else {
        out.push(ranges[i]);
      }
    }
    return out;
  }

  /** Every occurrence of every term, or null when the string holds none. */
  function matchString(folded, terms) {
    var ranges = [];
    var hitTerms = [];
    for (var t = 0; t < terms.length; t++) {
      var from = 0;
      var hit = false;
      while (true) {
        var pos = folded.indexOf(terms[t], from);
        if (pos === -1) break;
        hit = true;
        ranges.push([pos, pos + terms[t].length]);
        from = pos + terms[t].length;
      }
      if (hit) hitTerms.push(t);
    }
    if (!hitTerms.length) return null;
    return { hitTerms: hitTerms, ranges: mergeRanges(ranges) };
  }

  function isWordStart(folded, pos) {
    return pos === 0 || !WORD_CHAR.test(folded.charAt(pos - 1));
  }

  function scoreMatch(folded, m, termCount) {
    var score = m.hitTerms.length * 120;
    if (m.hitTerms.length === termCount) score += 300;
    var first = m.ranges[0];
    if (isWordStart(folded, first[0])) score += 60;
    if (first[0] === 0 && first[1] === folded.length) score += 250;
    return score - Math.min(first[0], 80) * 0.5;
  }

  /* --- Index --- */

  var index = null;

  /* The readable section names live only in the sidebar markup, so read them
     from there instead of keeping a second copy of the poem/section map. */
  function readSectionLabels() {
    var byPoem = {};
    document.querySelectorAll('.sidebar .poem-list[data-section]').forEach(function (ul) {
      var wrap = ul.closest ? ul.closest('.sidebar-section') : null;
      var nameEl = wrap && wrap.querySelector('.sidebar-section-name');
      var label = nameEl ? nameEl.textContent.trim() : '';
      ul.querySelectorAll('a[data-poem-id]').forEach(function (a) {
        byPoem[a.getAttribute('data-poem-id')] = label;
      });
    });
    return byPoem;
  }

  function titleFor(poem, lang) {
    if (lang === 'fr') return poem.title || (poem.titles && poem.titles.fr) || '';
    return (poem.titles && poem.titles[lang]) || '';
  }

  function buildIndex() {
    var ids = window.POEM_IDS || [];
    var poems = window.POEMS || {};
    var sections = readSectionLabels();
    var entries = [];

    ids.forEach(function (id, order) {
      var poem = poems[id];
      if (!poem) return;

      var titles = [];
      var lines = [];
      LANGS.forEach(function (lang) {
        var title = titleFor(poem, lang);
        if (title) titles.push({ lang: lang, text: title, folded: fold(title) });
      });
      (poem.segments || []).forEach(function (seg) {
        LANGS.forEach(function (lang) {
          var text = seg[lang];
          if (!text) return;
          lines.push({ tid: seg.id, lang: lang, text: text, folded: fold(text) });
        });
      });

      entries.push({
        id: id,
        order: order,
        title: titleFor(poem, 'fr') || id,
        section: sections[id] || '',
        titles: titles,
        lines: lines
      });
    });

    return entries;
  }

  function getIndex() {
    if (index && index.length) return index;
    index = buildIndex();
    return index;
  }

  /* --- Search --- */

  function coverTerms(covered, hitTerms) {
    for (var i = 0; i < hitTerms.length; i++) covered[hitTerms[i]] = true;
  }

  function searchEntry(entry, terms) {
    var covered = [];
    var titleHits = [];
    var byTid = {};
    var tids = [];
    var i, m;

    for (i = 0; i < entry.titles.length; i++) {
      var title = entry.titles[i];
      m = matchString(title.folded, terms);
      if (!m) continue;
      coverTerms(covered, m.hitTerms);
      titleHits.push({
        lang: title.lang, text: title.text, ranges: m.ranges,
        score: scoreMatch(title.folded, m, terms.length)
      });
    }

    for (i = 0; i < entry.lines.length; i++) {
      var line = entry.lines[i];
      m = matchString(line.folded, terms);
      if (!m) continue;
      coverTerms(covered, m.hitTerms);
      var score = scoreMatch(line.folded, m, terms.length);
      var hit = byTid[line.tid];
      if (!hit) {
        hit = byTid[line.tid] = {
          tid: line.tid, lang: line.lang, text: line.text,
          ranges: m.ranges, score: score, langs: []
        };
        tids.push(line.tid);
      } else if (score > hit.score) {
        /* the same line matched in several languages: show the strongest */
        hit.lang = line.lang;
        hit.text = line.text;
        hit.ranges = m.ranges;
        hit.score = score;
      }
      hit.langs.push(line.lang);
    }

    /* a poem qualifies only when every term turns up somewhere inside it */
    for (i = 0; i < terms.length; i++) {
      if (!covered[i]) return null;
    }

    var lines = tids.map(function (tid) { return byTid[tid]; });
    lines.sort(function (a, b) { return b.score - a.score || a.tid - b.tid; });
    titleHits.sort(function (a, b) { return b.score - a.score; });

    var frTitleHit = null;
    var altTitleHit = null;
    for (i = 0; i < titleHits.length; i++) {
      if (titleHits[i].lang === 'fr') {
        if (!frTitleHit) frTitleHit = titleHits[i];
      } else if (!altTitleHit) {
        altTitleHit = titleHits[i];
      }
    }

    /* a title hit outranks any line hit; more matching lines break ties */
    var best = titleHits.length ? titleHits[0].score + 500 : 0;
    if (lines.length && lines[0].score > best) best = lines[0].score;

    return {
      id: entry.id,
      order: entry.order,
      title: entry.title,
      section: entry.section,
      frTitleHit: frTitleHit,
      altTitleHit: altTitleHit,
      lines: lines,
      score: best + Math.min(lines.length, 6) * 8
    };
  }

  function search(query) {
    var terms = fold(query).split(/\s+/).filter(Boolean);
    var out = { terms: terms, groups: [], poemCount: 0, lineCount: 0 };
    if (!terms.length) return out;

    var entries = getIndex();
    for (var e = 0; e < entries.length; e++) {
      var group = searchEntry(entries[e], terms);
      if (!group) continue;
      out.groups.push(group);
      out.lineCount += group.lines.length;
    }
    out.groups.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    out.poemCount = out.groups.length;
    return out;
  }

  /* --- Rendering --- */

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  /** Translate folded-text ranges back into ranges of the original string. */
  function toOriginalRanges(text, foldedRanges) {
    var fm = foldWithMap(text);
    var limit = fm.map.length - 1;
    var out = [];
    for (var r = 0; r < foldedRanges.length; r++) {
      var a = foldedRanges[r][0];
      var b = Math.min(foldedRanges[r][1], limit);
      if (a >= limit) continue;
      var start = fm.map[a];
      var end = fm.map[b];
      /* the hit stopped part-way through a character that folded to several
         (cœur -> coeur): widen so the whole source character is marked */
      if (b > 0 && fm.map[b - 1] === end) end = Math.min(text.length, end + 1);
      if (end > start) out.push([start, end]);
    }
    return out;
  }

  function renderSnippet(text, ranges) {
    var start = 0;
    var end = text.length;
    if (text.length > SNIPPET_MAX) {
      var focus = ranges.length ? ranges[0][0] : 0;
      start = Math.max(0, focus - Math.floor(SNIPPET_MAX / 3));
      while (start > 0 && /\S/.test(text.charAt(start - 1))) start--;
      end = Math.min(text.length, start + SNIPPET_MAX);
    }

    var html = start > 0 ? '…' : '';
    var cursor = start;
    for (var r = 0; r < ranges.length; r++) {
      var a = Math.max(ranges[r][0], cursor);
      var b = Math.min(ranges[r][1], end);
      if (b <= a) continue;
      html += escapeHtml(text.slice(cursor, a));
      html += '<mark class="search-mark">' + escapeHtml(text.slice(a, b)) + '</mark>';
      cursor = b;
    }
    html += escapeHtml(text.slice(cursor, end));
    if (end < text.length) html += '…';
    return html;
  }

  function marked(hit) {
    return renderSnippet(hit.text, toOriginalRanges(hit.text, hit.ranges));
  }

  function langBadge(lang) {
    return '<span class="search-lang">' + (LANG_LABELS[lang] || lang) + '</span>';
  }

  function orderedLangs(hit) {
    var out = [hit.lang];
    LANGS.forEach(function (lang) {
      if (lang !== hit.lang && hit.langs.indexOf(lang) !== -1) out.push(lang);
    });
    return out;
  }

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  /* --- Palette --- */

  var ICON = '<svg class="search-glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false">'
    + '<circle cx="6.75" cy="6.75" r="4.25"></circle>'
    + '<line x1="9.9" y1="9.9" x2="14" y2="14"></line></svg>';

  var ui = null;
  var state = { query: '', result: null, items: [], active: -1, expanded: {} };
  var lastFocus = null;

  function shortcutLabel() {
    var id = (navigator.platform || '') + ' ' + (navigator.userAgent || '');
    return /Mac|iPhone|iPad|iPod/.test(id) ? '⌘K' : 'Ctrl K';
  }

  function buildUI() {
    var overlay = document.createElement('div');
    overlay.className = 'search-overlay';
    overlay.setAttribute('hidden', '');
    overlay.innerHTML = ''
      + '<div class="search-panel" role="dialog" aria-modal="true" aria-label="Search poems">'
      +   '<div class="search-field">'
      +     ICON
      +     '<input class="search-input" type="text" role="combobox" aria-expanded="true"'
      +       ' aria-controls="search-results" aria-autocomplete="list" autocomplete="off"'
      +       ' autocapitalize="off" spellcheck="false"'
      +       ' aria-label="Search"'
      +       ' placeholder="Search">'
      +     '<button type="button" class="search-clear" aria-label="Clear search" hidden>×</button>'
      +   '</div>'
      +   '<div class="search-results" id="search-results" role="listbox" aria-label="Search results"></div>'
      +   '<div class="search-foot">'
      +     '<span class="search-hint"><kbd>↑</kbd><kbd>↓</kbd> move</span>'
      +     '<span class="search-hint"><kbd>↵</kbd> open</span>'
      +     '<span class="search-hint"><kbd>esc</kbd> close</span>'
      +     '<span class="search-count" aria-live="polite"></span>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(overlay);

    var handle = {
      overlay: overlay,
      input: overlay.querySelector('.search-input'),
      clear: overlay.querySelector('.search-clear'),
      results: overlay.querySelector('.search-results'),
      count: overlay.querySelector('.search-count')
    };

    handle.input.addEventListener('input', onQuery);
    handle.clear.addEventListener('click', function () {
      handle.input.value = '';
      handle.input.focus();
      onQuery();
    });
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) close();
    });
    overlay.addEventListener('keydown', onPaletteKey);
    handle.results.addEventListener('click', function (e) {
      var item = e.target.closest ? e.target.closest('.search-item') : null;
      if (item) activate(item);
    });
    handle.results.addEventListener('mousemove', function (e) {
      var item = e.target.closest ? e.target.closest('.search-item') : null;
      if (!item) return;
      var at = state.items.indexOf(item);
      if (at >= 0 && at !== state.active) setActive(at, false);
    });

    return handle;
  }

  function isOpen() {
    return !!ui && !ui.overlay.hasAttribute('hidden');
  }

  function open() {
    if (!ui) ui = buildUI();
    if (!isOpen()) {
      lastFocus = document.activeElement;
      /* the palette covers the page, so the poem drawer must not stay open
         behind it -- and focus then has to come back to the bar, not to a
         button that is off-canvas again */
      if (document.body.classList.contains('sidebar-open')) {
        if (window.FLOWERS && window.FLOWERS.closeSidebar) window.FLOWERS.closeSidebar();
        lastFocus = document.querySelector('.topbar-menu') || lastFocus;
      }
      document.body.classList.add('modal-open');
      ui.overlay.removeAttribute('hidden');
    }
    ui.input.focus();
    ui.input.select();
    onQuery();
  }

  function close() {
    if (!isOpen()) return;
    ui.overlay.setAttribute('hidden', '');
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  function onQuery() {
    var value = ui.input.value;
    if (value !== state.query || !state.result) {
      state.query = value;
      state.expanded = {};
      state.active = -1;
      state.result = search(value);
    }
    ui.clear.hidden = !value;
    render();
  }

  function emptyState(text) {
    var el = document.createElement('p');
    el.className = 'search-empty';
    el.textContent = text;
    return el;
  }

  function makeItem(className, poemId) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'search-item ' + className;
    el.id = 'search-item-' + state.items.length;
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', 'false');
    el.setAttribute('tabindex', '-1');
    if (poemId) el.setAttribute('data-poem', poemId);
    state.items.push(el);
    return el;
  }

  function renderLineItem(group, hit) {
    var el = makeItem('search-item--line', group.id);
    el.setAttribute('data-tid', String(hit.tid));
    if (COLUMN_LANGS.indexOf(hit.lang) !== -1) el.setAttribute('data-lang', hit.lang);

    var num = document.createElement('span');
    num.className = 'search-line-num';
    num.textContent = String(hit.tid + 1);

    var text = document.createElement('span');
    text.className = 'search-line-text';
    text.innerHTML = marked(hit);

    var langs = document.createElement('span');
    langs.className = 'search-line-langs';
    langs.innerHTML = orderedLangs(hit).map(langBadge).join('');

    el.appendChild(num);
    el.appendChild(text);
    el.appendChild(langs);
    return el;
  }

  function renderGroup(group) {
    var wrap = document.createElement('div');
    wrap.className = 'search-group';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', group.title);

    var head = makeItem('search-item--poem', group.id);
    /* found by its English or Spanish title: open that translation as well */
    if (group.altTitleHit && COLUMN_LANGS.indexOf(group.altTitleHit.lang) !== -1) {
      head.setAttribute('data-lang', group.altTitleHit.lang);
    }

    var title = document.createElement('span');
    title.className = 'search-poem-title';
    title.innerHTML = group.frTitleHit ? marked(group.frTitleHit) : escapeHtml(group.title);
    head.appendChild(title);

    if (group.altTitleHit) {
      var alt = document.createElement('span');
      alt.className = 'search-poem-alt';
      alt.innerHTML = langBadge(group.altTitleHit.lang) + marked(group.altTitleHit);
      head.appendChild(alt);
    }

    var meta = document.createElement('span');
    meta.className = 'search-poem-meta';
    meta.textContent = [group.section, group.lines.length ? plural(group.lines.length, 'line') : '']
      .filter(Boolean).join(' · ');
    head.appendChild(meta);
    wrap.appendChild(head);

    /* pick the strongest lines, then show them in the order they are read */
    var limit = state.expanded[group.id]
      ? group.lines.length
      : Math.min(group.lines.length, LINES_COLLAPSED);
    var shown = group.lines.slice(0, limit).sort(function (a, b) { return a.tid - b.tid; });
    for (var i = 0; i < shown.length; i++) wrap.appendChild(renderLineItem(group, shown[i]));

    if (group.lines.length > limit) {
      var more = makeItem('search-item--more');
      more.setAttribute('data-expand', group.id);
      more.textContent = plural(group.lines.length - limit, 'more line');
      wrap.appendChild(more);
    }

    return wrap;
  }

  function render() {
    var res = state.result;
    ui.results.innerHTML = '';
    state.items = [];

    if (!res || !res.terms.length) {
      ui.results.appendChild(emptyState(
        'Full text search. '
        + 'Accents are optional: "ame" finds "âme".'));
      ui.count.textContent = '';
      setActive(-1, false);
      return;
    }

    if (!res.groups.length) {
      ui.results.appendChild(emptyState('Nothing found for “' + state.query.trim() + '”.'));
      ui.count.textContent = 'No results';
      setActive(-1, false);
      return;
    }

    var shown = res.groups.slice(0, MAX_POEMS);
    shown.forEach(function (group) { ui.results.appendChild(renderGroup(group)); });

    var count = plural(res.poemCount, 'poem') + ' · ' + plural(res.lineCount, 'line');
    if (shown.length < res.groups.length) count += ' · first ' + shown.length + ' shown';
    ui.count.textContent = count;

    setActive(state.active >= 0 ? Math.min(state.active, state.items.length - 1) : 0, false);
  }

  function setActive(at, scroll) {
    if (!state.items.length) at = -1;
    else if (at < 0) at = 0;
    else if (at > state.items.length - 1) at = state.items.length - 1;

    state.items.forEach(function (el, n) {
      var on = n === at;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    state.active = at;

    if (at < 0) {
      ui.input.removeAttribute('aria-activedescendant');
      return;
    }
    ui.input.setAttribute('aria-activedescendant', state.items[at].id);
    if (scroll && state.items[at].scrollIntoView) {
      state.items[at].scrollIntoView({ block: 'nearest' });
    }
  }

  function move(delta) {
    if (!state.items.length) return;
    var at = state.active + delta;
    if (at < 0) at = state.items.length - 1;
    if (at > state.items.length - 1) at = 0;
    setActive(at, true);
  }

  function activate(item) {
    if (!item) return;

    var expand = item.getAttribute('data-expand');
    if (expand) {
      state.expanded[expand] = true;
      var at = state.active;
      render();
      setActive(at, true);
      return;
    }

    var id = item.getAttribute('data-poem');
    if (!id) return;
    var tid = item.getAttribute('data-tid');
    var lang = item.getAttribute('data-lang');

    close();

    var api = window.FLOWERS;
    if (!api || !api.switchPoem) {
      window.location.hash = id;
      return;
    }
    if (id !== window.CURRENT_POEM_ID) api.switchPoem(id);
    if (lang && api.setTranslationLang) api.setTranslationLang(lang);
    if (tid != null && tid !== '' && api.focusLine) {
      var line = parseInt(tid, 10);
      /* queued after switchPoem's scroll-to-top, so the line wins the scroll */
      window.setTimeout(function () { api.focusLine(line); }, 0);
    }
  }

  function onPaletteKey(e) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Enter':
        e.preventDefault();
        if (state.active >= 0) activate(state.items[state.active]);
        break;
      case 'Tab':
        /* the palette is driven from the input; don't let focus wander out */
        e.preventDefault();
        break;
    }
  }

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function initGlobalKeys() {
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        if (isOpen()) close();
        else open();
        return;
      }
      if (isOpen()) return;   /* the palette handles its own keys */
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        open();
      }
    });
  }

  /* The rail's faux input, plus the narrow-screen top bar's icon */
  function initTriggers() {
    document.querySelectorAll('.sidebar-search, .topbar-search').forEach(function (trigger) {
      if (!trigger.querySelector('.search-glyph')) trigger.insertAdjacentHTML('afterbegin', ICON);
      var key = trigger.querySelector('.sidebar-search-key');
      if (key) key.textContent = shortcutLabel();
      trigger.addEventListener('click', function () { open(); });
    });
  }

  function init() {
    initTriggers();
    initGlobalKeys();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* exposed for console checks: window.FLOWERS_SEARCH('mort') */
  window.FLOWERS_SEARCH = search;
})();
