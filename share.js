/* Share to Instagram.

   Instagram has no address a page can hand a post to, so the site makes the
   post itself: a card of the poem, or of a few of its lines, in one or two of
   its languages, painted onto a canvas at Instagram's own sizes and given to
   the share sheet where the browser has one (`navigator.share` with files,
   which on a phone lists Instagram) and saved as a file where it has not.

   Two ways in. A drag over the verse brings up a small *Share* button under
   the selection; the floating Instagram button at the foot of the window
   opens the same dialog with the whole poem. The dialog is built once and toggled with [hidden], like the
   search palette, and reaches into the page only through `window.FLOWERS`
   and `window.META`, feature-detecting both.

   A card is laid out in three passes: `buildSpec` turns the chosen lines into
   stanza units, `layout` measures them against the card at falling type sizes
   until every stanza fits on some card (splitting a stanza across cards only
   as a last resort), and `paint` draws one card. Two languages are set one
   stanza after the other rather than side by side: an alexandrine wants the
   whole width at any size a feed can read. */
(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.document) return;

  var BASE = document.documentElement.getAttribute('data-base') || '';
  var STORE_KEY = 'flowers-share';

  /* --- What a card is ---------------------------------------------------- */

  var W = 1080;
  var FORMATS = {
    /* top / bottom keep the verse clear of Instagram's own chrome */
    portrait: { w: W, h: 1350, top: 96, bottom: 104, side: 96, ext: 'png' },
    story:    { w: W, h: 1920, top: 260, bottom: 270, side: 96, ext: 'png' }
  };
  var VERSE_SIZES = [34, 32, 30, 28, 26];
  var LINE_HEIGHT = 1.38;
  var HANG = 1.4;              /* em: hanging indent of a wrapped verse line */
  var TR_INDENT = 28;          /* the translation stanza steps in, with a rule */
  var CARD_INSET = 28;         /* paper: margin around the torn card */
  var EDGE_TILE = 384;         /* must match TILE / SLICE in tools/build-textures.mjs */
  var EDGE_SLICE = 96;
  var FOOT_H = 72;
  var RUNNING_H = 70;
  var CAROUSEL_MAX = 10;

  var DISPLAY = '"Cormorant Garamond", Georgia, serif';
  var BODY = '"Libre Baskerville", Georgia, serif';
  var FONTS = {
    title:    '600 62px ' + DISPLAY,
    subtitle: 'italic 400 38px ' + DISPLAY,
    byline:   '600 26px ' + DISPLAY,
    part:     '600 28px ' + DISPLAY,
    running:  'italic 400 28px ' + DISPLAY,
    foot:     '400 24px ' + DISPLAY
  };
  function verseFont(size, italic) {
    return (italic ? 'italic ' : '') + '400 ' + size + 'px ' + BODY;
  }

  var NIGHTSCAPES = ['seine-paris', 'paris-rooftops', 'crescent-moon', 'milky-way-lake', 'starry-lake', 'fog-lamp'];

  var PALETTES = {
    paperLight: { bg: '#e6dfd3', card: '#f5f0e8', ink: '#1a1512', tr: '#6f5a3a', accent: '#6b2d2d', muted: '#8b7355', rule: '#c4b8a8', shadow: false },
    paperDark:  { bg: '#151210', card: '#27221d', ink: '#e8e2da', tr: '#b09272', accent: '#c97a7a', muted: '#a08060', rule: '#4a4139', shadow: false },
    night:      { bg: '#0b0910', card: null,      ink: '#f3ede3', tr: '#d9cdb8', accent: '#e2c9a0', muted: '#c9b48c', rule: 'rgba(233, 214, 180, 0.55)', shadow: true }
  };

  var LANG_NAMES = { en: 'English', es: 'Español' };

  var TEXT = {
    title:    { en: 'Share this poem', es: 'Compartir este poema' },
    close:    { en: 'Close', es: 'Cerrar' },
    lines:    { en: 'Lines', es: 'Líneas' },
    from:     { en: 'From', es: 'Desde' },
    to:       { en: 'to', es: 'hasta' },
    whole:    { en: 'Whole poem', es: 'Poema completo' },
    langs:    { en: 'Languages (up to two)', es: 'Idiomas (hasta dos)' },
    format:   { en: 'Format', es: 'Formato' },
    post:     { en: 'Post 4:5', es: 'Publicación 4:5' },
    story:    { en: 'Story 9:16', es: 'Historia 9:16' },
    style:    { en: 'Style', es: 'Estilo' },
    paper:    { en: 'Paper', es: 'Papel' },
    night:    { en: 'Night', es: 'Noche' },
    photo:    { en: 'Another photo', es: 'Otra foto' },
    noPhotos: { en: 'Photos are available on the website.', es: 'Las fotos están disponibles en el sitio web.' },
    share:    { en: 'Share…', es: 'Compartir…' },
    download: { en: 'Download', es: 'Descargar' },
    caption:  { en: 'Copy caption', es: 'Copiar texto' },
    copied:   { en: 'Caption copied', es: 'Texto copiado' },
    one:      { en: '1 image', es: '1 imagen' },
    many:     { en: '%d images', es: '%d imágenes' },
    warn:     { en: 'Instagram shows up to 10 images in one post.', es: 'Instagram muestra hasta 10 imágenes en una publicación.' },
    saved:    { en: 'Saved', es: 'Guardado' },
    working:  { en: 'Preparing…', es: 'Preparando…' },
    failed:   { en: 'Could not make the image.', es: 'No se pudo crear la imagen.' },
    preview:  { en: 'Preview of the card', es: 'Vista previa de la tarjeta' },
    prevPage: { en: 'Previous image', es: 'Imagen anterior' },
    nextPage: { en: 'Next image', es: 'Imagen siguiente' },
    selShare: { en: 'Share', es: 'Compartir' }
  };

  function t(key) {
    var strings = TEXT[key];
    if (!strings) return '';
    return window.SITE_LANG ? window.SITE_LANG.pick(strings) : strings.en;
  }

  /* --- Small helpers ------------------------------------------------------ */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function clean(s) {
    return String(s == null ? '' : s).replace(/\uFEFF/g, '').replace(/\s+/g, ' ').trim();
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function isTr(code) { return code !== 'fr'; }

  function baseLang(code) {
    if (window.BRAVO && window.BRAVO.base) return window.BRAVO.base(code) || code;
    return code.replace(/-bravo$/, '');
  }

  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
  }

  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var args = arguments;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  function loadPrefs() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      var prefs = raw ? JSON.parse(raw) : {};
      return {
        format: FORMATS[prefs.format] ? prefs.format : 'portrait',
        style: prefs.style === 'night' ? 'night' : 'paper'
      };
    } catch (e) {
      return { format: 'portrait', style: 'paper' };
    }
  }

  function savePrefs(state) {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ format: state.format, style: state.style }));
    } catch (e) { /* a preference, not a record */ }
  }

  /* --- Assets --------------------------------------------------------------
     Textures and photographs are fetched once each and kept. Paths are built
     here from data-base rather than written into markup, since the build
     script rewrites every src it finds in the page for the page's depth. */

  var images = {};
  var texturesOK = null;   /* null until probed; false where drawing a local
                              image would taint the canvas (file://) */

  function loadImage(path) {
    if (images[path]) return images[path];
    images[path] = new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('could not load ' + path)); };
      img.src = BASE + path;
    });
    return images[path];
  }

  /* Whether an image drawn onto a canvas leaves it exportable. Off disk it
     does not, and the only way to know is to try. */
  function probeTextures() {
    if (texturesOK !== null) return Promise.resolve(texturesOK);
    return loadImage('assets/paper.png').then(function (img) {
      try {
        var c = document.createElement('canvas');
        c.width = 2; c.height = 2;
        var cx = c.getContext('2d');
        cx.drawImage(img, 0, 0);
        cx.getImageData(0, 0, 1, 1);
        texturesOK = true;
      } catch (e) {
        texturesOK = false;
      }
      return texturesOK;
    }, function () {
      texturesOK = false;
      return false;
    });
  }

  function assetsFor(state) {
    return probeTextures().then(function (ok) {
      if (!ok) return {};
      if (state.style === 'night') {
        return loadImage('assets/nightscapes/' + NIGHTSCAPES[state.photo % NIGHTSCAPES.length] + '.jpg')
          .then(function (photo) { return { photo: photo }; });
      }
      var wants = [loadImage(isDark() ? 'assets/burnt-edge-dark.png' : 'assets/burnt-edge.png')];
      if (!isDark()) wants.push(loadImage('assets/paper.png'));
      return Promise.all(wants).then(function (list) {
        return { edge: list[0], grain: list[1] || null };
      });
    });
  }

  var fontsReady = null;
  function ensureFonts() {
    if (fontsReady) return fontsReady;
    if (!document.fonts || !document.fonts.load) {
      fontsReady = Promise.resolve();
      return fontsReady;
    }
    var wanted = [FONTS.title, FONTS.subtitle, FONTS.byline, verseFont(34, false), verseFont(34, true)];
    var all = Promise.all(wanted.map(function (f) {
      return document.fonts.load(f).then(null, function () {});
    }));
    var timeout = new Promise(function (resolve) { window.setTimeout(resolve, 3000); });
    fontsReady = Promise.race([all, timeout]).then(function () {});
    return fontsReady;
  }

  /* --- Spec: the chosen lines as stanza units ------------------------------ */

  function poemOf(id) {
    return (window.POEMS || {})[id] || null;
  }

  function buildSpec(state) {
    var poem = poemOf(state.poemId);
    if (!poem || !poem.segments) return null;
    var segments = poem.segments;
    var blocks = poem.blocks && poem.blocks.length ? poem.blocks : [{ type: 'stanza', lines: segments.length }];
    var units = [];
    var at = 0;
    var pendingPart = null;
    blocks.forEach(function (block) {
      if (block.type === 'part') {
        pendingPart = block.label || null;
        return;
      }
      if (block.type !== 'stanza') return;
      var lines = block.lines || 4;
      var first = at, last = Math.min(at + lines, segments.length) - 1;
      at += lines;
      if (last < state.from || first > state.to) { pendingPart = null; return; }
      var lo = Math.max(first, state.from), hi = Math.min(last, state.to);
      units.push({
        part: lo === first ? pendingPart : null,
        groups: state.langs.map(function (lang) {
          var out = [];
          for (var i = lo; i <= hi; i++) out.push(clean(segments[i][lang]));
          return { lang: lang, tr: isTr(lang), lines: out };
        })
      });
      pendingPart = null;
    });

    var trLang = null;
    for (var i = 0; i < state.langs.length; i++) if (isTr(state.langs[i])) trLang = state.langs[i];
    var frTitle = clean(poem.title || (poem.titles && poem.titles.fr));
    var trTitle = trLang && poem.titles ? clean(poem.titles[trLang]) : '';
    var frFirst = state.langs.indexOf('fr') !== -1 || !trTitle;

    return {
      poem: poem,
      units: units,
      langs: state.langs,
      title: frFirst ? frTitle : trTitle,
      subtitle: frFirst ? (trTitle && trTitle !== frTitle ? trTitle : '') : frTitle,
      credits: state.langs.filter(isTr).map(function (code) {
        var who = window.META && window.META.TRANSLATORS && window.META.TRANSLATORS[code];
        var name = LANG_NAMES[baseLang(code)] || code;
        return who ? name + ' · ' + who : name;
      })
    };
  }

  /* --- Layout --------------------------------------------------------------- */

  /* Verse breaks on spaces, but French sets a space before ! ? : ; and before
     a closing guillemet; those stay with the word they follow. */
  function tokens(text) {
    var words = text.split(' ');
    var out = [];
    words.forEach(function (w) {
      if (!w) return;
      if (out.length && /^[!?;:»”]/.test(w)) out[out.length - 1] += ' ' + w;
      else if (out.length && /[«“]$/.test(out[out.length - 1])) out[out.length - 1] += ' ' + w;
      else out.push(w);
    });
    return out;
  }

  function wrap(ctx, text, maxW, indent) {
    if (!text) return [''];
    var words = tokens(text);
    var lines = [];
    var cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      var avail = maxW - (lines.length ? indent : 0);
      if (cur && ctx.measureText(test).width > avail) {
        lines.push(cur);
        cur = words[i];
      } else {
        cur = test;
      }
    }
    lines.push(cur);
    return lines;
  }

  function rowsOf(ctx, unit, size, measure) {
    var lh = size * LINE_HEIGHT;
    var rows = [];
    if (unit.part) rows.push({ type: 'part', label: unit.part, h: 28 * 1.6 + 14 });
    unit.groups.forEach(function (group, gi) {
      if (gi) rows.push({ type: 'gap', h: lh * 0.6 });
      ctx.font = verseFont(size, group.tr);
      var width = measure - (group.tr ? TR_INDENT : 0);
      group.lines.forEach(function (text) {
        wrap(ctx, text, width, size * HANG).forEach(function (piece, wi) {
          rows.push({ type: 'line', text: piece, tr: group.tr, cont: wi > 0, h: lh });
        });
      });
    });
    return rows;
  }

  /* The title block on the first card, measured or drawn: one function so the
     two can never disagree. Returns the y where the verse begins. */
  function titleBlock(ctx, spec, fmt, pal, draw, offset) {
    var measure = fmt.w - fmt.side * 2;
    var y = fmt.top + (offset || 0);
    ctx.textAlign = 'center';
    ctx.font = FONTS.title;
    wrap(ctx, spec.title, measure, 0).forEach(function (line) {
      if (draw) { ctx.fillStyle = pal.accent; ctx.fillText(line, fmt.w / 2, y + 62 * 0.8); }
      y += 62 * 1.08;
    });
    if (spec.subtitle) {
      y += 4;
      ctx.font = FONTS.subtitle;
      wrap(ctx, spec.subtitle, measure, 0).forEach(function (line) {
        if (draw) { ctx.fillStyle = pal.tr; ctx.fillText(line, fmt.w / 2, y + 38 * 0.8); }
        y += 38 * 1.2;
      });
    }
    y += 12;
    ctx.font = FONTS.byline;
    if (draw) {
      ctx.fillStyle = pal.muted;
      setSpacing(ctx, '0.14em');
      ctx.fillText('CHARLES BAUDELAIRE · LES FLEURS DU MAL', fmt.w / 2, y + 26 * 0.8);
      setSpacing(ctx, '0px');
    }
    y += 26 * 1.2 + 18;
    if (draw) {
      var g = ctx.createLinearGradient(fmt.w / 2 - 70, 0, fmt.w / 2 + 70, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, pal.muted);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(fmt.w / 2 - 70, y, 140, 2);
    }
    y += 2 + 38;
    ctx.textAlign = 'left';
    return y;
  }

  function setSpacing(ctx, value) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = value;
  }

  function paginate(ctx, spec, fmt, size, splitLines) {
    var measure = fmt.w - fmt.side * 2;
    var lh = size * LINE_HEIGHT;
    var stanzaGap = lh;
    var firstTop = titleBlock(ctx, spec, fmt, null, false);
    var bottom = fmt.h - fmt.bottom - FOOT_H - 18;
    var pages = [];
    var page = null;

    function newPage() {
      page = { n: pages.length + 1, top: pages.length ? fmt.top + RUNNING_H : firstTop, bottom: bottom, rows: [], overflow: false };
      pages.push(page);
      return page.top;
    }

    var y = newPage();
    spec.units.forEach(function (unit) {
      var rows = rowsOf(ctx, unit, size, measure);
      var h = 0;
      rows.forEach(function (r) { h += r.h; });
      if (y + h > bottom && page.rows.length) y = newPage();
      if (y + h > bottom && !splitLines) page.overflow = true;
      rows.forEach(function (row) {
        if (splitLines && y + row.h > bottom && page.rows.length) {
          y = newPage();
          if (row.type === 'gap') return;
        }
        row.y = y;
        page.rows.push(row);
        y += row.h;
      });
      y += stanzaGap;
    });
    pages.forEach(function (p) { p.N = pages.length; });
    return { size: size, pages: pages };
  }

  /* The largest type that puts it all on one card; failing that, the largest
     that costs at most one card more than the smallest would — a bigger face
     is worth a card, not two; failing that, the smallest type with stanzas
     allowed to run over a card's edge. */
  function layout(ctx, spec, fmt) {
    var whole = VERSE_SIZES.map(function (size) {
      return paginate(ctx, spec, fmt, size, false);
    }).filter(function (a) {
      return a.pages.every(function (p) { return !p.overflow; });
    });
    if (!whole.length) return centre(paginate(ctx, spec, fmt, VERSE_SIZES[VERSE_SIZES.length - 1], true));
    for (var i = 0; i < whole.length; i++) {
      if (whole[i].pages.length === 1) return centre(whole[i]);
    }
    var fewest = Math.min.apply(null, whole.map(function (a) { return a.pages.length; }));
    for (var j = 0; j < whole.length; j++) {
      if (whole[j].pages.length <= fewest + 1) return whole[j];
    }
    return whole[whole.length - 1];
  }

  /* One card carries its verse in the middle rather than hanging from the
     title; a carousel keeps every card's top in the same place instead. */
  function centre(result) {
    if (result.pages.length !== 1) return result;
    var page = result.pages[0];
    var end = page.top;
    page.rows.forEach(function (row) { end = Math.max(end, row.y + row.h); });
    page.offset = Math.max(0, Math.floor((page.bottom - end) / 2));
    return result;
  }

  /* --- Paint --------------------------------------------------------------- */

  function drawNineSlice(ctx, img, x, y, w, h) {
    var T = EDGE_TILE, S = EDGE_SLICE, run = T - 2 * S;
    ctx.drawImage(img, 0, 0, S, S, x, y, S, S);
    ctx.drawImage(img, T - S, 0, S, S, x + w - S, y, S, S);
    ctx.drawImage(img, 0, T - S, S, S, x, y + h - S, S, S);
    ctx.drawImage(img, T - S, T - S, S, S, x + w - S, y + h - S, S, S);
    /* the strips repeat a whole number of times, each stretched a little so
       the periodic noise meets itself; a pixel of overlap hides the joins */
    var lenX = w - 2 * S, nX = Math.max(1, Math.round(lenX / run)), segW = lenX / nX;
    for (var i = 0; i < nX; i++) {
      var dx = x + S + i * segW, dw = segW + (i < nX - 1 ? 1 : 0);
      ctx.drawImage(img, S, 0, run, S, dx, y, dw, S);
      ctx.drawImage(img, S, T - S, run, S, dx, y + h - S, dw, S);
    }
    var lenY = h - 2 * S, nY = Math.max(1, Math.round(lenY / run)), segH = lenY / nY;
    for (var j = 0; j < nY; j++) {
      var dy = y + S + j * segH, dh = segH + (j < nY - 1 ? 1 : 0);
      ctx.drawImage(img, 0, S, S, run, x, dy, S, dh);
      ctx.drawImage(img, T - S, S, S, run, x + w - S, dy, S, dh);
    }
  }

  /* The torn card. The edge tile's paper is white with the grain baked in, so
     the frame is drawn with a white centre and the whole then multiplied by
     the paper colour: white becomes paper, the char stays char, the shadow
     stays black, and the tile's own alpha is put back at the end so the tear
     and the shadow's falloff survive the multiply. The dark tile is already
     the dark paper colour and needs none of that. */
  function paperCard(fmt, pal, assets) {
    var cw = fmt.w - CARD_INSET * 2, ch = fmt.h - CARD_INSET * 2;
    var frame = document.createElement('canvas');
    frame.width = cw; frame.height = ch;
    var f = frame.getContext('2d');
    var S = EDGE_SLICE;
    drawNineSlice(f, assets.edge, 0, 0, cw, ch);
    f.fillStyle = isDark() ? pal.card : '#ffffff';
    f.fillRect(S, S, cw - 2 * S, ch - 2 * S);
    if (assets.grain) {
      f.fillStyle = f.createPattern(assets.grain, 'repeat');
      f.fillRect(S, S, cw - 2 * S, ch - 2 * S);
    }
    if (isDark()) return frame;
    var out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    var o = out.getContext('2d');
    o.drawImage(frame, 0, 0);
    o.globalCompositeOperation = 'multiply';
    o.fillStyle = pal.card;
    o.fillRect(0, 0, cw, ch);
    o.globalCompositeOperation = 'destination-in';
    o.drawImage(frame, 0, 0);
    return out;
  }

  function drawBackground(ctx, fmt, style, pal, assets) {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, fmt.w, fmt.h);
    if (style === 'night') {
      if (assets.photo) {
        var img = assets.photo;
        var s = Math.max(fmt.w / img.width, fmt.h / img.height);
        var dw = img.width * s, dh = img.height * s;
        ctx.drawImage(img, (fmt.w - dw) / 2, (fmt.h - dh) / 2, dw, dh);
      }
      ctx.fillStyle = 'rgba(10, 8, 14, 0.48)';
      ctx.fillRect(0, 0, fmt.w, fmt.h);
      var top = ctx.createLinearGradient(0, 0, 0, fmt.h * 0.3);
      top.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
      top.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, fmt.w, fmt.h * 0.3);
      var foot = ctx.createLinearGradient(0, fmt.h * 0.65, 0, fmt.h);
      foot.addColorStop(0, 'rgba(0, 0, 0, 0)');
      foot.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
      ctx.fillStyle = foot;
      ctx.fillRect(0, fmt.h * 0.65, fmt.w, fmt.h * 0.35);
      return;
    }
    if (assets.edge) {
      ctx.drawImage(paperCard(fmt, pal, assets), CARD_INSET, CARD_INSET);
    } else {
      ctx.fillStyle = pal.card;
      ctx.fillRect(CARD_INSET, CARD_INSET, fmt.w - CARD_INSET * 2, fmt.h - CARD_INSET * 2);
      ctx.strokeStyle = pal.rule;
      ctx.lineWidth = 1;
      ctx.strokeRect(CARD_INSET + 0.5, CARD_INSET + 0.5, fmt.w - CARD_INSET * 2 - 1, fmt.h - CARD_INSET * 2 - 1);
    }
  }

  function textShadow(ctx, on) {
    ctx.shadowColor = on ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0)';
    ctx.shadowBlur = on ? 8 : 0;
    ctx.shadowOffsetY = on ? 1 : 0;
  }

  function paint(canvas, spec, result, page, fmt, style, assets) {
    var pal = style === 'night' ? PALETTES.night : (isDark() ? PALETTES.paperDark : PALETTES.paperLight);
    canvas.width = fmt.w;
    canvas.height = fmt.h;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';
    drawBackground(ctx, fmt, style, pal, assets);
    textShadow(ctx, pal.shadow);

    var x0 = fmt.side;
    var size = result.size;
    var off = page.offset || 0;
    if (page.n === 1) {
      titleBlock(ctx, spec, fmt, pal, true, off);
    } else {
      ctx.font = FONTS.running;
      ctx.fillStyle = pal.muted;
      ctx.textAlign = 'left';
      ctx.fillText(spec.title, x0, fmt.top + 28 * 0.8);
    }

    ctx.textAlign = 'left';
    page.rows.forEach(function (row) {
      if (row.type === 'gap') return;
      if (row.type === 'part') {
        ctx.font = FONTS.part;
        ctx.fillStyle = pal.muted;
        ctx.textAlign = 'center';
        setSpacing(ctx, '0.18em');
        ctx.fillText(row.label, fmt.w / 2, row.y + off + 28 * 0.8 + 8);
        setSpacing(ctx, '0px');
        ctx.textAlign = 'left';
        return;
      }
      ctx.font = verseFont(size, row.tr);
      ctx.fillStyle = row.tr ? pal.tr : pal.ink;
      var x = x0 + (row.tr ? TR_INDENT : 0) + (row.cont ? size * HANG : 0);
      ctx.fillText(row.text, x, row.y + off + size * 0.8 + (row.h - size) / 2);
      if (row.tr) {
        textShadow(ctx, false);
        ctx.fillStyle = pal.rule;
        ctx.fillRect(x0 + 8, row.y + off, 2, row.h + 0.5);
        textShadow(ctx, pal.shadow);
      }
    });

    /* foot: who wrote it, who translated it, where it lives */
    var footTop = fmt.h - fmt.bottom - FOOT_H;
    textShadow(ctx, false);
    ctx.fillStyle = pal.rule;
    ctx.fillRect(x0, footTop, fmt.w - x0 * 2, 1);
    textShadow(ctx, pal.shadow);
    ctx.font = FONTS.foot;
    ctx.fillStyle = pal.muted;
    ctx.textAlign = 'left';
    var last = fmt.h - fmt.bottom - 8;
    var lines = [];
    if (page.n > 1) lines.push('Charles Baudelaire · Les Fleurs du mal');
    if (spec.credits.length) lines.push(spec.credits.join(' · '));
    var ly = last;
    for (var i = lines.length - 1; i >= 0; i--) {
      ctx.fillText(lines[i], x0, ly);
      ly -= 32;
    }
    ctx.textAlign = 'right';
    var right = 'floresdelmal.org';
    if (page.N > 1) right += '   ' + page.n + ' / ' + page.N;
    ctx.fillText(right, fmt.w - x0, last);
    ctx.textAlign = 'left';
    textShadow(ctx, false);
    return canvas;
  }

  /* --- Rendering: a state in, cards out ------------------------------------ */

  var work = null;
  function workCanvas() {
    if (!work) work = document.createElement('canvas');
    return work;
  }

  /* Lays the chosen lines out and returns something that can paint any of
     the resulting cards. Assets and fonts are awaited here, so a paint is
     synchronous afterwards. */
  function render(state) {
    var spec = buildSpec(state);
    if (!spec) return Promise.reject(new Error('no poem'));
    var fmt = FORMATS[state.format] || FORMATS.portrait;
    return Promise.all([ensureFonts(), assetsFor(state)]).then(function (got) {
      var assets = got[1];
      var ctx = workCanvas().getContext('2d');
      var result = layout(ctx, spec, fmt);
      return {
        count: result.pages.length,
        pages: result.pages,
        paint: function (index, canvas) {
          return paint(canvas || workCanvas(), spec, result, result.pages[index], fmt, state.style, assets);
        },
        ext: state.style === 'night' ? 'jpg' : fmt.ext
      };
    });
  }

  function toBlob(canvas, ext) {
    return new Promise(function (resolve, reject) {
      try {
        var type = ext === 'jpg' ? 'image/jpeg' : 'image/png';
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob); else reject(new Error('no blob'));
        }, type, 0.92);
      } catch (e) {
        reject(e);
      }
    });
  }

  function fileName(state, n, N, ext) {
    var stem = state.poemId + '-' + state.langs.join('-');
    if (N > 1) stem += '-' + n + 'of' + N;
    return stem + '.' + ext;
  }

  function renderAll(state) {
    return render(state).then(function (r) {
      var files = [];
      var chain = Promise.resolve();
      r.pages.forEach(function (page, i) {
        chain = chain.then(function () {
          return toBlob(r.paint(i), r.ext).then(function (blob) {
            var name = fileName(state, i + 1, r.count, r.ext);
            files.push(new File([blob], name, { type: blob.type }));
          });
        });
      });
      return chain.then(function () { return files; });
    });
  }

  /* --- Caption ------------------------------------------------------------- */

  function caption(state) {
    var poem = poemOf(state.poemId);
    if (!poem) return '';
    var trLang = null;
    state.langs.forEach(function (l) { if (isTr(l)) trLang = l; });
    var title = clean(poem.title);
    var trTitle = trLang && poem.titles ? clean(poem.titles[trLang]) : '';
    var lines = [title + (trTitle && trTitle !== title ? ' · ' + trTitle : '')];
    lines.push('Charles Baudelaire — Les Fleurs du mal (1861)');
    state.langs.filter(isTr).forEach(function (code) {
      var credit = poem.sources && poem.sources[code];
      if (credit) lines.push(clean(credit));
    });
    if (window.META && window.META.poemUrl) lines.push(window.META.poemUrl(state.poemId));
    lines.push('');
    lines.push('#Baudelaire #LesFleursDuMal #poetry #poésie #poesía #floresdelmal');
    return lines.join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  /* --- The dialog ---------------------------------------------------------- */

  var ui = null;
  var state = null;
  var lastFocus = null;
  var canShareFiles = false;
  var current = null;        /* { key, result } of the last preview */
  var pageIndex = 0;
  var renderSeq = 0;
  var cache = { key: null, files: null };

  function stateKey(s) {
    return JSON.stringify([s.poemId, s.from, s.to, s.langs, s.format, s.style, s.photo, isDark()]);
  }

  function buildUI() {
    var overlay = el('div', 'share-overlay');
    overlay.setAttribute('hidden', '');
    overlay.innerHTML = ''
      + '<div class="share-panel" role="dialog" aria-modal="true" aria-labelledby="share-title" tabindex="-1">'
      +   '<div class="share-header">'
      +     '<h2 class="share-title" id="share-title" data-t="title"></h2>'
      +     '<button type="button" class="share-close" data-t-aria="close">×</button>'
      +   '</div>'
      +   '<div class="share-body">'
      +     '<form class="share-form">'
      +       '<fieldset class="share-lines">'
      +         '<legend data-t="lines"></legend>'
      +         '<div class="share-range">'
      +           '<label><span data-t="from"></span> <select class="share-from"></select></label>'
      +           '<label><span data-t="to"></span> <select class="share-to"></select></label>'
      +           '<button type="button" class="share-whole share-link" data-t="whole"></button>'
      +         '</div>'
      +       '</fieldset>'
      +       '<fieldset class="share-langs">'
      +         '<legend data-t="langs"></legend>'
      +         '<div class="share-choice share-lang-list"></div>'
      +       '</fieldset>'
      +       '<fieldset class="share-format">'
      +         '<legend data-t="format"></legend>'
      +         '<div class="share-choice">'
      +           '<label><input type="radio" name="share-format" value="portrait"> <span data-t="post"></span></label>'
      +           '<label><input type="radio" name="share-format" value="story"> <span data-t="story"></span></label>'
      +         '</div>'
      +       '</fieldset>'
      +       '<fieldset class="share-style">'
      +         '<legend data-t="style"></legend>'
      +         '<div class="share-choice">'
      +           '<label><input type="radio" name="share-style" value="paper"> <span data-t="paper"></span></label>'
      +           '<label class="share-style-night"><input type="radio" name="share-style" value="night"> <span data-t="night"></span></label>'
      +           '<button type="button" class="share-photo-next share-link" data-t="photo" hidden></button>'
      +         '</div>'
      +         '<p class="share-note share-no-photos" data-t="noPhotos" hidden></p>'
      +       '</fieldset>'
      +     '</form>'
      +     '<div class="share-preview">'
      +       '<canvas class="share-canvas" width="1080" height="1350" data-t-aria="preview"></canvas>'
      +       '<div class="share-pages" hidden>'
      +         '<button type="button" class="share-page-btn share-page-prev" data-t-aria="prevPage">‹</button>'
      +         '<span class="share-page-count"></span>'
      +         '<button type="button" class="share-page-btn share-page-next" data-t-aria="nextPage">›</button>'
      +       '</div>'
      +       '<p class="share-count"></p>'
      +     '</div>'
      +   '</div>'
      +   '<div class="share-actions">'
      +     '<button type="button" class="share-primary"></button>'
      +     '<button type="button" class="share-caption" data-t="caption"></button>'
      +     '<p class="share-status" aria-live="polite"></p>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(overlay);

    var q = function (sel) { return overlay.querySelector(sel); };
    var handle = {
      overlay: overlay,
      panel: q('.share-panel'),
      close: q('.share-close'),
      form: q('.share-form'),
      from: q('.share-from'),
      to: q('.share-to'),
      whole: q('.share-whole'),
      langList: q('.share-lang-list'),
      nightLabel: q('.share-style-night'),
      photoNext: q('.share-photo-next'),
      noPhotos: q('.share-no-photos'),
      canvas: q('.share-canvas'),
      pages: q('.share-pages'),
      pagePrev: q('.share-page-prev'),
      pageNext: q('.share-page-next'),
      pageCount: q('.share-page-count'),
      count: q('.share-count'),
      primary: q('.share-primary'),
      captionBtn: q('.share-caption'),
      status: q('.share-status')
    };

    handle.close.addEventListener('click', close);
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) close();
    });
    overlay.addEventListener('keydown', onKey);
    handle.form.addEventListener('submit', function (e) { e.preventDefault(); });
    handle.from.addEventListener('change', function () {
      state.from = Number(handle.from.value);
      if (state.to < state.from) { state.to = state.from; handle.to.value = String(state.to); }
      changed();
    });
    handle.to.addEventListener('change', function () {
      state.to = Number(handle.to.value);
      if (state.from > state.to) { state.from = state.to; handle.from.value = String(state.from); }
      changed();
    });
    handle.whole.addEventListener('click', function () {
      var poem = poemOf(state.poemId);
      state.from = 0;
      state.to = poem.segments.length - 1;
      handle.from.value = '0';
      handle.to.value = String(state.to);
      changed();
    });
    handle.langList.addEventListener('change', onLangChange);
    handle.form.addEventListener('change', function (e) {
      var input = e.target;
      if (input.name === 'share-format' && input.checked) {
        state.format = input.value;
        savePrefs(state);
        changed();
      } else if (input.name === 'share-style' && input.checked) {
        state.style = input.value;
        savePrefs(state);
        syncStyleUi();
        changed();
      }
    });
    handle.photoNext.addEventListener('click', function () {
      state.photo = (state.photo + 1) % NIGHTSCAPES.length;
      changed();
      /* the one after is likely next */
      loadImage('assets/nightscapes/' + NIGHTSCAPES[(state.photo + 1) % NIGHTSCAPES.length] + '.jpg').then(null, function () {});
    });
    handle.pagePrev.addEventListener('click', function () { showPage(pageIndex - 1); });
    handle.pageNext.addEventListener('click', function () { showPage(pageIndex + 1); });
    handle.primary.addEventListener('click', onPrimary);
    handle.captionBtn.addEventListener('click', function () {
      copyText(caption(state)).then(function () {
        setStatus(t('copied'));
      }, function () {
        setStatus(t('failed'));
      });
    });

    return handle;
  }

  function applyText() {
    if (!ui) return;
    ui.overlay.querySelectorAll('[data-t]').forEach(function (node) {
      node.textContent = t(node.getAttribute('data-t'));
    });
    ui.overlay.querySelectorAll('[data-t-aria]').forEach(function (node) {
      node.setAttribute('aria-label', t(node.getAttribute('data-t-aria')));
    });
    ui.primary.textContent = canShareFiles ? t('share') : t('download');
    if (selectionBtn) selectionBtn.textContent = t('selShare');
    if (current) showCount(current.result.count);
  }

  function setStatus(text) {
    if (ui) ui.status.textContent = text || '';
  }

  function isOpen() {
    return !!ui && !ui.overlay.hasAttribute('hidden');
  }

  function focusables() {
    return Array.prototype.filter.call(
      ui.panel.querySelectorAll('button, select, input, [tabindex]:not([tabindex="-1"])'),
      function (node) { return !node.disabled && !node.hidden && node.offsetParent !== null; }
    );
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      var list = focusables();
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ui.panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* --- Filling the form for a poem --- */

  function lineOptions(select, segments, value) {
    select.innerHTML = '';
    segments.forEach(function (seg, i) {
      var opt = document.createElement('option');
      var text = clean(seg.fr);
      if (text.length > 42) text = text.slice(0, 41).replace(/\s+\S*$/, '') + '…';
      opt.value = String(i);
      opt.textContent = (i + 1) + '  ' + text;
      select.appendChild(opt);
    });
    select.value = String(value);
  }

  function translationCodes(id) {
    if (window.META && window.META.translationCodes) {
      return window.META.translationCodes(id, window.POEMS, window.BRAVO);
    }
    return [];
  }

  function fillLangs() {
    var codes = ['fr'].concat(translationCodes(state.poemId));
    ui.langList.innerHTML = '';
    codes.forEach(function (code) {
      var label = el('label');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.value = code;
      box.checked = state.langs.indexOf(code) !== -1;
      label.appendChild(box);
      label.appendChild(document.createTextNode(' '));
      var name = window.FLOWERS && window.FLOWERS.langLabel ? window.FLOWERS.langLabel(code) : code;
      label.appendChild(el('span', null, name));
      ui.langList.appendChild(label);
    });
    syncLangUi();
  }

  function syncLangUi() {
    var boxes = ui.langList.querySelectorAll('input');
    var full = state.langs.length >= 2;
    var only = boxes.length === 1;
    boxes.forEach(function (box) {
      var off = only || (full && !box.checked);
      box.disabled = off;
      box.parentNode.classList.toggle('is-disabled', off);
    });
  }

  function onLangChange(e) {
    var box = e.target;
    if (!box || box.type !== 'checkbox') return;
    var code = box.value;
    var at = state.langs.indexOf(code);
    if (box.checked && at === -1) {
      if (state.langs.length >= 2) { box.checked = false; return; }
      state.langs.push(code);
    } else if (!box.checked && at !== -1) {
      if (state.langs.length === 1) { box.checked = true; return; }
      state.langs.splice(at, 1);
    }
    /* French first, the way the page reads */
    state.langs.sort(function (a, b) { return (a === 'fr' ? 0 : 1) - (b === 'fr' ? 0 : 1); });
    syncLangUi();
    changed();
  }

  function syncStyleUi() {
    ui.photoNext.hidden = state.style !== 'night' || texturesOK === false;
    ui.nightLabel.hidden = texturesOK === false;
    ui.noPhotos.hidden = texturesOK !== false;
  }

  function defaultLangs(poemId) {
    var langs = ['fr'];
    var shown = window.FLOWERS && window.FLOWERS.getTranslationLang ? window.FLOWERS.getTranslationLang() : null;
    var codes = translationCodes(poemId);
    if (shown && codes.indexOf(shown) !== -1) langs.push(shown);
    else if (codes.length) langs.push(codes[0]);
    return langs;
  }

  function probeShare() {
    try {
      if (!navigator.share || !navigator.canShare) return false;
      var probe = new File([new Uint8Array([137, 80, 78, 71])], 'probe.png', { type: 'image/png' });
      return navigator.canShare({ files: [probe] });
    } catch (e) {
      return false;
    }
  }

  function open(opts) {
    opts = opts || {};
    var poemId = window.FLOWERS && window.FLOWERS.getPoemId ? window.FLOWERS.getPoemId() : null;
    var poem = poemOf(poemId);
    if (!poem || !poem.segments || !poem.segments.length) return;
    if (!ui) ui = buildUI();

    var prefs = loadPrefs();
    var lastLine = poem.segments.length - 1;
    var from = 0, to = lastLine;
    var tids = opts.tids || (window.FLOWERS.getSelectedTids ? window.FLOWERS.getSelectedTids() : []);
    if (tids && tids.length) {
      from = Math.max(0, Math.min(lastLine, tids[0]));
      to = Math.max(from, Math.min(lastLine, tids[tids.length - 1]));
    }
    state = {
      poemId: poemId,
      from: from,
      to: to,
      langs: defaultLangs(poemId),
      format: prefs.format,
      style: prefs.style,
      photo: hash(poemId) % NIGHTSCAPES.length
    };
    canShareFiles = probeShare();

    lineOptions(ui.from, poem.segments, from);
    lineOptions(ui.to, poem.segments, to);
    fillLangs();
    ui.form.querySelector('input[name="share-format"][value="' + state.format + '"]').checked = true;
    ui.form.querySelector('input[name="share-style"][value="' + state.style + '"]').checked = true;
    applyText();
    syncStyleUi();
    setStatus('');
    current = null;
    pageIndex = 0;

    hideSelectionBtn();
    if (!isOpen()) {
      lastFocus = document.activeElement;
      if (document.body.classList.contains('sidebar-open')) {
        if (window.FLOWERS.closeSidebar) window.FLOWERS.closeSidebar();
        lastFocus = document.querySelector('.topbar-menu') || lastFocus;
      }
      document.body.classList.add('modal-open');
      ui.overlay.removeAttribute('hidden');
    }
    ui.panel.focus();

    /* off disk the photos cannot be drawn; find out before offering them */
    probeTextures().then(function (ok) {
      if (!ok && state.style === 'night') {
        state.style = 'paper';
        ui.form.querySelector('input[name="share-style"][value="paper"]').checked = true;
      }
      syncStyleUi();
      changed();
    });
  }

  function close() {
    if (!isOpen()) return;
    ui.overlay.setAttribute('hidden', '');
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  /* --- Preview --- */

  var changed = debounce(function () {
    if (!isOpen() || !state) return;
    var key = stateKey(state);
    if (current && current.key === key) return;
    var seq = ++renderSeq;
    setStatus('');
    render(state).then(function (result) {
      if (seq !== renderSeq || !isOpen()) return;
      current = { key: key, result: result };
      if (pageIndex >= result.count) pageIndex = 0;
      showPage(pageIndex);
      showCount(result.count);
      scheduleFiles(key);
    }, function () {
      if (seq !== renderSeq) return;
      setStatus(t('failed'));
    });
  }, 150);

  function showPage(index) {
    if (!current) return;
    var N = current.result.count;
    pageIndex = Math.max(0, Math.min(N - 1, index));
    var fmt = FORMATS[state.format] || FORMATS.portrait;
    var painted = current.result.paint(pageIndex);
    ui.canvas.width = fmt.w;
    ui.canvas.height = fmt.h;
    ui.canvas.getContext('2d').drawImage(painted, 0, 0);
    ui.pages.hidden = N < 2;
    ui.pageCount.textContent = (pageIndex + 1) + ' / ' + N;
    ui.pagePrev.disabled = pageIndex === 0;
    ui.pageNext.disabled = pageIndex === N - 1;
  }

  function showCount(N) {
    var text = N === 1 ? t('one') : t('many').replace('%d', String(N));
    ui.count.textContent = text + (N > CAROUSEL_MAX ? ' — ' + t('warn') : '');
    ui.count.classList.toggle('share-warn', N > CAROUSEL_MAX);
  }

  /* The files are made in the idle time after a preview, so that the share
     button has them ready and can answer the tap at once. */
  function scheduleFiles(key) {
    var later = window.requestIdleCallback || function (fn) { window.setTimeout(fn, 300); };
    later(function () {
      if (!isOpen() || !state || stateKey(state) !== key || cache.key === key) return;
      renderAll(state).then(function (files) {
        if (stateKey(state) === key) cache = { key: key, files: files };
      }, function () {});
    });
  }

  function getFiles() {
    var key = stateKey(state);
    if (cache.key === key && cache.files) return Promise.resolve(cache.files);
    return renderAll(state).then(function (files) {
      cache = { key: key, files: files };
      return files;
    });
  }

  /* --- Share / download --- */

  function onPrimary() {
    if (!state) return;
    ui.primary.disabled = true;
    setStatus(t('working'));
    getFiles().then(function (files) {
      ui.primary.disabled = false;
      if (canShareFiles) {
        var poem = poemOf(state.poemId);
        return navigator.share({ files: files, title: clean(poem.title), text: caption(state) }).then(function () {
          setStatus('');
        }, function (err) {
          if (err && err.name === 'AbortError') { setStatus(''); return; }
          downloadAll(files);
        });
      }
      downloadAll(files);
    }, function () {
      ui.primary.disabled = false;
      setStatus(t('failed'));
    });
  }

  function downloadAll(files) {
    files.forEach(function (file, i) {
      window.setTimeout(function () {
        var url = URL.createObjectURL(file);
        var a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      }, i * 350);
    });
    setStatus(t('saved') + ' · ' + (files.length === 1 ? t('one') : t('many').replace('%d', String(files.length))));
  }

  /* --- The button that follows a selection --------------------------------- */

  var selectionBtn = null;
  var selTids = [];

  function buildSelectionBtn() {
    selectionBtn = el('button', 'poem-nav-btn share-selection-btn', t('selShare'));
    selectionBtn.type = 'button';
    selectionBtn.setAttribute('hidden', '');
    selectionBtn.setAttribute('aria-haspopup', 'dialog');
    /* the press must not collapse the selection before it is read */
    selectionBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    selectionBtn.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    selectionBtn.addEventListener('click', function () {
      var tids = selTids.slice();
      hideSelectionBtn();
      open({ tids: tids });
    });
    document.body.appendChild(selectionBtn);
  }

  function hideSelectionBtn() {
    if (selectionBtn) selectionBtn.setAttribute('hidden', '');
  }

  function placeSelectionBtn() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) { hideSelectionBtn(); return; }
    var rect = sel.getRangeAt(sel.rangeCount - 1).getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) { hideSelectionBtn(); return; }
    var vw = window.innerWidth, vh = window.innerHeight;
    if (rect.bottom < 0 || rect.top > vh) { hideSelectionBtn(); return; }
    selectionBtn.removeAttribute('hidden');
    var bw = selectionBtn.offsetWidth, bh = selectionBtn.offsetHeight;
    var left = Math.max(8, Math.min(vw - bw - 8, rect.left + rect.width / 2 - bw / 2));
    var top = rect.bottom + 8;
    if (top + bh > vh - 8) top = rect.top - bh - 8;
    selectionBtn.style.left = left + 'px';
    selectionBtn.style.top = top + 'px';
  }

  var onSelection = debounce(function () {
    if (!selectionBtn) return;
    if (isOpen()) { hideSelectionBtn(); return; }
    var tids = window.FLOWERS.getSelectedTids ? window.FLOWERS.getSelectedTids() : [];
    if (!tids.length) { hideSelectionBtn(); return; }
    selTids = tids;
    placeSelectionBtn();
  }, 200);

  function initSelectionBtn() {
    buildSelectionBtn();
    document.addEventListener('selectionchange', onSelection);
    var follow = function () {
      if (!selectionBtn || selectionBtn.hasAttribute('hidden')) return;
      window.requestAnimationFrame(placeSelectionBtn);
    };
    window.addEventListener('scroll', follow, { capture: true, passive: true });
    window.addEventListener('resize', follow);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideSelectionBtn();
    });
  }

  /* --- Wiring -------------------------------------------------------------- */

  function supported() {
    if (!window.FLOWERS || !window.META) return false;
    var c = document.createElement('canvas');
    return !!(c.getContext && c.getContext('2d') && c.toBlob && window.File && window.URL && URL.createObjectURL);
  }

  function init() {
    if (!supported()) return;
    var btn = document.querySelector('.poem-share-btn');
    if (btn) {
      btn.removeAttribute('hidden');
      btn.addEventListener('click', function () { open(); });
    }
    initSelectionBtn();
    document.addEventListener('flowers:poemchange', function () {
      hideSelectionBtn();
      close();
    });
    if (window.SITE_LANG && window.SITE_LANG.onChange) window.SITE_LANG.onChange(applyText);
  }

  window.SHARE = { open: open, close: close, render: render, renderAll: renderAll, caption: caption };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
