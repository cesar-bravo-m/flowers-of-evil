/**
 * Edit mode — writing a translation of your own, line against line.
 *
 * This file is never fetched by a published copy of the site. The guard at the
 * top of index.html only injects it when the page is being served from a local
 * dev server, and even then it does nothing until `GET /api/edit/status`
 * answers — so the reader's build has no authoring code in it at all, and
 * opening index.html straight off disk has none either.
 *
 * The reader's aligned grid cannot give you a text box per line, so edit mode
 * lays the poem out flat instead: line number, the French, the existing
 * translation for reference, and the box you type into. Line count is fixed by
 * the French and cannot be changed here, which is what keeps the two columns
 * paired when the translation is later read.
 *
 * Nothing is kept in the browser. Typing stops, and a second and a half later
 * the whole translation is written into the poem's own `.js` file as a draft.
 * A draft is invisible to a reader — only "Mark complete" puts it in the
 * language dropdown, and it is refused while any line is still blank.
 */
(function () {
  'use strict';

  var API = '/api/edit';
  var MODE_KEY = 'flowers-edit-mode';
  var AUTOSAVE_MS = 1500;

  var LANGS = ['en-bravo', 'es-bravo'];
  var LANG_NAMES = { 'en-bravo': 'English (Bravo)', 'es-bravo': 'Español (Bravo)' };
  var BASE = { 'en-bravo': 'en', 'es-bravo': 'es' };
  var TRANSLATOR = { en: 'Scott', es: 'Marquina' };

  var state = {
    on: false,
    poemId: null,
    lang: LANGS[0],
    title: '',
    lines: [],
    showRef: true,
    status: '',
    error: '',
    git: null
  };

  var els = {};
  var saveTimer = null;
  var inFlight = null;
  var pendingSave = false;   /* typing that has not reached the file yet */

  /* --- Small helpers ------------------------------------------------------ */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function store(value) {
    try { localStorage.setItem(MODE_KEY, value); } catch (e) {}
  }

  function stored() {
    try { return localStorage.getItem(MODE_KEY); } catch (e) { return null; }
  }

  function api(path, options) {
    return fetch(API + path, options).then(function (r) {
      return r.json().then(function (body) {
        if (!r.ok || !body.ok) throw new Error(body.error || ('HTTP ' + r.status));
        return body;
      });
    });
  }

  function poem() {
    return (window.POEMS || {})[state.poemId] || null;
  }

  function segments() {
    var p = poem();
    return (p && p.segments) || [];
  }

  /* The server collapses whitespace and trims before it writes. Do the same on
     the way out so what is held in memory matches what is on disk — but never
     to the box itself, which would fight you mid-word. */
  function normalise(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function payload() {
    return {
      poemId: state.poemId,
      lang: state.lang,
      title: normalise(state.title),
      lines: state.lines.map(normalise)
    };
  }

  function translatedCount() {
    return state.lines.filter(function (l) { return normalise(l); }).length;
  }

  /* --- Loading and storing the poem's own block --------------------------- */

  function loadFromPoem() {
    var p = poem();
    var entry = p && p.bravo && p.bravo[state.lang];
    var total = segments().length;
    state.lines = [];
    for (var i = 0; i < total; i++) {
      state.lines.push((entry && entry.lines && entry.lines[i]) || '');
    }
    state.title = (entry && entry.title) || '';
    state.status = (entry && entry.status) || '';
    state.error = '';
  }

  /* Keep `window.POEMS` in step with what was just written, so leaving edit
     mode shows the translation without a reload. Takes what was actually sent
     rather than reading current state, since by the time a save lands you may
     have moved on to another poem. */
  function writeBackToPoem(poemId, lang, body, status) {
    var p = (window.POEMS || {})[poemId];
    if (!p) return;
    p.bravo = p.bravo || {};
    if (!body.lines.some(Boolean) && !body.title) delete p.bravo[lang];
    else p.bravo[lang] = { status: status, title: body.title, lines: body.lines };
    if (window.BRAVO) window.BRAVO.apply(poemId);
    if (window.FLOWERS_SEARCH && window.FLOWERS_SEARCH.reset) window.FLOWERS_SEARCH.reset();
  }

  /* --- Saving ------------------------------------------------------------- */

  function setNote(text, kind) {
    if (!els.note) return;
    els.note.textContent = text;
    els.note.className = 'edit-note' + (kind ? ' edit-note--' + kind : '');
  }

  /* Is the bar still describing the translation this save was for? A poem
     switch mid-flight must not repaint the new poem with the old one's result. */
  function stillShowing(poemId, lang) {
    return state.poemId === poemId && state.lang === lang;
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    pendingSave = true;
    setNote('unsaved', 'pending');
    saveTimer = window.setTimeout(flush, AUTOSAVE_MS);
  }

  /* Writes only when there is something to write. Leaving edit mode, switching
     poem and committing all pass through here, and a save with nothing new to
     say would touch the file for no reason — leaving the tree dirty straight
     after a commit. */
  function flush() {
    window.clearTimeout(saveTimer);
    if (!pendingSave || !state.poemId || !state.lines.length) return Promise.resolve();
    pendingSave = false;

    var poemId = state.poemId;
    var lang = state.lang;
    var body = payload();
    /* a finished translation stays finished as you keep polishing it */
    body.status = state.status === 'complete' && translatedCount() === state.lines.length
      ? 'complete' : 'draft';

    setNote('saving…', 'pending');

    function run() {
      return api('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (saved) {
        writeBackToPoem(poemId, lang, body, saved.status);
        if (!stillShowing(poemId, lang)) return;
        state.status = saved.status;
        setNote(saved.status === 'complete' ? 'saved · complete' : 'saved · draft', 'ok');
        syncBar();
      }).catch(function (e) {
        if (stillShowing(poemId, lang)) setNote(e.message, 'error');
      });
    }

    /* Saves queue behind one another, so two can never race to rewrite the
       same file — and one that fails does not strand the ones after it. */
    inFlight = (inFlight || Promise.resolve()).then(run, run);
    return inFlight;
  }

  function markComplete() {
    window.clearTimeout(saveTimer);
    pendingSave = false;              /* the commit writes it; nothing left over */

    var poemId = state.poemId;
    var lang = state.lang;
    var body = payload();

    setNote('committing…', 'pending');
    api('/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (saved) {
      writeBackToPoem(poemId, lang, body, saved.status);
      state.status = saved.status;
      setNote('committed ' + saved.commit, 'ok');
      setMode(false);
      if (window.FLOWERS && window.FLOWERS.setTranslationLang) window.FLOWERS.setTranslationLang(lang);
    }).catch(function (e) {
      setNote(e.message, 'error');
    });
  }

  /* --- The bar ------------------------------------------------------------ */

  function buildBar() {
    var bar = el('div', 'edit-bar');

    var langs = el('div', 'edit-langs');
    langs.setAttribute('role', 'group');
    langs.setAttribute('aria-label', 'Translation being written');
    els.langButtons = LANGS.map(function (lang) {
      var b = el('button', 'edit-lang', LANG_NAMES[lang]);
      b.type = 'button';
      b.setAttribute('data-lang', lang);
      b.addEventListener('click', function () { setLang(lang); });
      langs.appendChild(b);
      return b;
    });

    var titleField = el('label', 'edit-field');
    titleField.appendChild(el('span', 'edit-field-label', 'Title'));
    els.title = el('input', 'edit-input-text');
    els.title.type = 'text';
    els.title.placeholder = 'Title in this language';
    els.title.addEventListener('input', function () {
      state.title = this.value;
      scheduleSave();
    });
    titleField.appendChild(els.title);

    els.ref = el('button', 'edit-toggle', 'Reference');
    els.ref.type = 'button';
    els.ref.addEventListener('click', function () {
      state.showRef = !state.showRef;
      document.body.classList.toggle('edit-no-ref', !state.showRef);
      syncBar();
    });

    els.progress = el('span', 'edit-progress');
    els.note = el('span', 'edit-note');
    els.file = el('span', 'edit-file');

    els.save = el('button', 'edit-btn edit-btn--quiet', 'Save now');
    els.save.type = 'button';
    els.save.addEventListener('click', function () { flush(); });

    els.commit = el('button', 'edit-btn', 'Mark complete & commit');
    els.commit.type = 'button';
    els.commit.addEventListener('click', markComplete);

    els.exit = el('button', 'edit-btn edit-btn--quiet', 'Exit');
    els.exit.type = 'button';
    els.exit.addEventListener('click', function () { setMode(false); });

    var top = el('div', 'edit-bar-row');
    top.appendChild(langs);
    top.appendChild(titleField);
    top.appendChild(els.ref);

    var bottom = el('div', 'edit-bar-row edit-bar-row--status');
    var left = el('div', 'edit-bar-status');
    left.appendChild(els.progress);
    left.appendChild(els.note);
    left.appendChild(els.file);
    var right = el('div', 'edit-bar-actions');
    right.appendChild(els.save);
    right.appendChild(els.commit);
    right.appendChild(els.exit);
    bottom.appendChild(left);
    bottom.appendChild(right);

    bar.appendChild(top);
    bar.appendChild(bottom);
    return bar;
  }

  function syncBar() {
    var total = state.lines.length;
    var done = translatedCount();

    els.langButtons.forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === state.lang ? 'true' : 'false');
    });
    if (els.title.value !== state.title) els.title.value = state.title;
    els.ref.setAttribute('aria-pressed', state.showRef ? 'true' : 'false');

    els.progress.textContent = done + ' / ' + total + ' lines'
      + (state.status === 'complete' ? ' · complete' : '');

    var ready = total > 0 && done === total && !!normalise(state.title);
    els.commit.disabled = !ready || !(state.git && state.git.isRepo);
    els.commit.title = !(state.git && state.git.isRepo)
      ? 'No git repository here, so there is nothing to commit to.'
      : ready ? 'Write it as finished and commit the poem file'
        : 'Every line and the title must be filled in first.';
  }

  /* --- The grid ----------------------------------------------------------- */

  function autoGrow(box) {
    box.style.height = 'auto';
    box.style.height = box.scrollHeight + 'px';
  }

  function referenceFor(seg) {
    var base = BASE[state.lang];
    var other = base === 'en' ? 'es' : 'en';
    if (seg[base]) return { lang: base, text: seg[base] };
    if (seg[other]) return { lang: other, text: seg[other] };
    return null;
  }

  function buildRow(seg, index) {
    var row = el('div', 'edit-row');
    row.appendChild(el('span', 'edit-num', String(index + 1)));

    var source = el('div', 'edit-source');
    source.appendChild(el('p', 'edit-fr', seg.fr || ''));
    var ref = referenceFor(seg);
    if (ref) {
      var p = el('p', 'edit-ref');
      p.appendChild(el('span', 'edit-ref-tag', TRANSLATOR[ref.lang] || ref.lang));
      p.appendChild(document.createTextNode(ref.text));
      source.appendChild(p);
    }
    row.appendChild(source);

    var box = el('textarea', 'edit-line');
    box.rows = 1;
    box.spellcheck = true;
    box.value = state.lines[index] || '';
    box.setAttribute('data-index', String(index));
    box.setAttribute('aria-label', 'Line ' + (index + 1));
    box.addEventListener('input', function () {
      state.lines[index] = this.value;
      autoGrow(this);
      syncBar();
      scheduleSave();
    });
    box.addEventListener('keydown', function (e) {
      /* a line of verse is one line: Enter moves on rather than wrapping */
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        var next = els.grid.querySelector('.edit-line[data-index="' + (index + 1) + '"]');
        if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
        else flush();
      }
    });
    row.appendChild(box);
    return row;
  }

  function buildGrid() {
    var grid = els.grid;
    grid.innerHTML = '';
    var p = poem();
    if (!p) return;

    var segs = segments();
    var blocks = (p.blocks && p.blocks.length) ? p.blocks : [{ type: 'stanza', lines: segs.length }];
    var i = 0;

    blocks.forEach(function (block) {
      if (block.type === 'blank') {
        grid.appendChild(el('div', 'edit-gap'));
        return;
      }
      if (block.type === 'part') {
        grid.appendChild(el('div', 'edit-part', block.label || ''));
        return;
      }
      var take = block.lines || segs.length;
      var stanza = el('div', 'edit-stanza');
      segs.slice(i, i + take).forEach(function (seg, n) {
        stanza.appendChild(buildRow(seg, i + n));
      });
      i += take;
      grid.appendChild(stanza);
    });

    /* any lines the blocks did not account for still need somewhere to go */
    if (i < segs.length) {
      var rest = el('div', 'edit-stanza');
      segs.slice(i).forEach(function (seg, n) { rest.appendChild(buildRow(seg, i + n)); });
      grid.appendChild(rest);
    }

    window.requestAnimationFrame(function () {
      grid.querySelectorAll('.edit-line').forEach(autoGrow);
    });
  }

  /* --- Mode --------------------------------------------------------------- */

  function loadPoemIntoEditor() {
    state.poemId = window.FLOWERS ? window.FLOWERS.getPoemId() : window.CURRENT_POEM_ID;
    loadFromPoem();

    /* prefer whichever of the two you have already started here */
    var p = poem();
    if (p && p.bravo && !p.bravo[state.lang]) {
      var started = LANGS.filter(function (l) { return p.bravo[l]; });
      if (started.length) { state.lang = started[0]; loadFromPoem(); }
    }

    buildGrid();
    syncBar();
    setNote(state.status ? 'saved · ' + state.status : 'nothing written yet', state.status ? 'ok' : '');

    api('/poem?id=' + encodeURIComponent(state.poemId)).then(function (info) {
      els.file.textContent = info.file;
      if (info.segmentCount !== state.lines.length) {
        setNote('This poem has ' + info.segmentCount + ' lines on disk but '
          + state.lines.length + ' in the page — reload before editing.', 'error');
      }
    }).catch(function (e) { setNote(e.message, 'error'); });
  }

  function setLang(lang) {
    if (lang === state.lang) return;
    flush();                          /* no-op unless this one has unsaved text */
    state.lang = lang;
    loadFromPoem();
    buildGrid();
    syncBar();
    setNote(state.status ? 'saved · ' + state.status : 'nothing written yet', state.status ? 'ok' : '');
  }

  function setMode(on) {
    if (on === state.on) return;
    state.on = on;
    store(on ? '1' : '0');
    document.body.classList.toggle('edit-mode', on);
    els.toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    els.toggle.title = on ? 'Leave edit mode' : 'Write a translation';

    if (on) {
      /* the editor only makes sense over a poem */
      if (document.body.getAttribute('data-view') !== 'poem' && window.FLOWERS) {
        window.FLOWERS.switchPoem(window.CURRENT_POEM_ID);
      }
      loadPoemIntoEditor();
    } else {
      flush();
      if (window.FLOWERS && window.FLOWERS.rebuild) window.FLOWERS.rebuild();
    }
  }

  /* --- Wiring ------------------------------------------------------------- */

  function mount(status) {
    state.git = status.git;

    var controls = document.querySelector('.sidebar-controls');
    els.toggle = el('button', 'sidebar-control edit-toggle-btn', '✎');
    els.toggle.type = 'button';
    els.toggle.setAttribute('aria-label', 'Write a translation');
    els.toggle.setAttribute('aria-pressed', 'false');
    els.toggle.title = 'Write a translation';
    els.toggle.addEventListener('click', function () { setMode(!state.on); });
    if (controls) controls.appendChild(els.toggle);

    /* no heading of its own: the page header already names the poem, and the
       bar names the file the text is going into */
    var view = el('div', 'edit-view');
    els.grid = el('div', 'edit-grid');
    view.appendChild(buildBar());
    view.appendChild(els.grid);

    var wrap = document.querySelector('.comparison-wrap');
    if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(view, wrap);
    else document.querySelector('.page').appendChild(view);

    /* the sidebar, prev/next and search all still work; follow them */
    window.addEventListener('hashchange', function () {
      if (!state.on) return;
      var next = window.FLOWERS ? window.FLOWERS.getPoemId() : window.CURRENT_POEM_ID;
      if (next === state.poemId) return;
      flush();                       /* still holding the poem we are leaving */
      loadPoemIntoEditor();
    });

    document.addEventListener('keydown', function (e) {
      if (!state.on) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        flush();
      }
    });

    /* a pending autosave must not be lost to a reload */
    window.addEventListener('beforeunload', function () {
      flush();                        /* a pending autosave must survive a reload */
    });

    if (stored() === '1') setMode(true);
  }

  function start() {
    api('/status')
      .then(mount)
      .catch(function () { /* no dev server: edit mode simply does not exist */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
