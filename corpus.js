/**
 * corpus.js — the poems, fetched as they are needed.
 *
 * The site used to name all 133 poem files in a script tag apiece, in every
 * one of its 135 pages: 10 KB of identical markup per page, and a megabyte of
 * verse fetched to read one poem of it. A generated page now carries only the
 * poem it is about, and this fetches the rest — after the page has painted, so
 * nothing waits on it, and on demand where something asks for a poem sooner.
 *
 * `window.POEM_INDEX` (poems.js, written by tools/build-pages.mjs) says where
 * each poem's file is and carries the little that the sidebar, the prev/next
 * links and the meta tags need before the verse itself arrives: a title, and a
 * title per translation. Everything else comes out of the file.
 *
 * A script element does the fetching rather than fetch(), for the same reason
 * the page uses script tags at all: the site has to keep working opened
 * straight off disk, where a fetch() of a neighbouring file is a cross-origin
 * request and a `<script src>` is not.
 */
(function () {
  var INDEX = window.POEM_INDEX || {};
  var BASE = document.documentElement.getAttribute('data-base') || '';

  var pending = {};       /* id -> Promise, so two callers share one fetch */
  var everything = null;  /* the in-flight ensureAll(), made once */
  var ready = false;      /* the whole book has been through ensureAll() */
  var waiting = [];       /* whenComplete() callbacks, run when it has */

  /* Loaded means the verse is here — the manifest knows a poem's title long
     before its file has arrived, so the entry alone is not enough. */
  function has(id) {
    var poem = window.POEMS && window.POEMS[id];
    return !!(poem && poem.segments && poem.segments.length);
  }

  function ids() {
    return (window.POEM_IDS && window.POEM_IDS.length)
      ? window.POEM_IDS
      : Object.keys(INDEX);
  }

  function meta(id) {
    return INDEX[id] || null;
  }

  /* One poem's file. It registers itself into window.POEMS as it runs, so by
     the time onload fires there is nothing left to do but fold. */
  function fetchOne(id) {
    var entry = INDEX[id];
    if (!entry || !entry.src) {
      return Promise.reject(new Error('corpus: no file listed for ' + id));
    }
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = BASE + entry.src;
      s.onload = function () {
        /* The site's own translations ride in a block on the poem, and
           bravo.js folds them onto the segments. Its one pass ran over
           whatever was loaded at parse time, so a poem arriving after that
           has to be folded here or its Bravo lines never reach a reader. */
        if (window.BRAVO && window.BRAVO.apply) window.BRAVO.apply(id);
        resolve(id);
      };
      s.onerror = function () {
        reject(new Error('corpus: could not load ' + entry.src));
      };
      document.head.appendChild(s);
    });
  }

  function ensure(id) {
    if (has(id)) return Promise.resolve(id);
    if (!pending[id]) {
      pending[id] = fetchOne(id).catch(function (err) {
        delete pending[id];   /* a failed load is worth retrying */
        throw err;
      });
    }
    return pending[id];
  }

  function flush() {
    var fns = waiting.slice();
    waiting.length = 0;
    fns.forEach(function (fn) {
      try { fn(); } catch (e) { /* a listener's problem, not ours */ }
    });
  }

  /* The whole book, for the two things that need all of it: search, and
     switching poems without a wait. One file failing does not fail the batch —
     a poem that will not load should cost that poem, not the search. */
  function ensureAll() {
    if (ready) return Promise.resolve();
    if (!everything) {
      everything = Promise.all(ids().map(function (id) {
        return ensure(id).catch(function () { return null; });
      })).then(function () {
        ready = true;
        everything = null;
        flush();
      });
    }
    return everything;
  }

  /* Called once the page has painted, so the rest of the book loads in a quiet
     moment rather than competing with the stylesheet and the fonts.

     It is a megabyte of verse for a reader who may only want the one poem, so
     a reader who has said not to spend it is taken at their word: nothing is
     fetched ahead of time, and ensure() and search still pull what they need
     when they need it. */
  function prefetch() {
    if (ready) return;
    var conn = window.navigator && window.navigator.connection;
    if (conn && conn.saveData) return;
    var go = function () { ensureAll(); };
    if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 3000 });
    else window.setTimeout(go, 400);
  }

  window.CORPUS = {
    has: has,
    meta: meta,
    ensure: ensure,
    ensureAll: ensureAll,
    prefetch: prefetch,
    isReady: function () { return ready; },
    /* Run fn once the whole book is in — immediately, if it already is. */
    whenComplete: function (fn) {
      if (ready) { fn(); return; }
      waiting.push(fn);
      ensureAll();
    }
  };

  if (document.readyState === 'complete') prefetch();
  else window.addEventListener('load', prefetch);
})();
