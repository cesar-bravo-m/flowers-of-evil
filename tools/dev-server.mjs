/**
 * Local authoring server for edit mode.  `node tools/dev-server.mjs`
 *
 * The site itself needs no server — it is opened as a file and always will be.
 * This exists for one reason: a browser cannot write to disk, and edit mode
 * has to put what you author — the translation you type, the backdrop you
 * pick — into the poem's own `.js` file. So it serves the site over http on
 * 127.0.0.1 (which is also what makes edit mode appear at all — see the guard
 * at the top of index.html) and adds the endpoints under /api/edit that read,
 * save and commit.
 *
 * Zero dependencies. Bound to the loopback address only, and it refuses
 * requests that did not address it as localhost, so nothing outside this
 * machine can reach a write.
 *
 * The curated part of a poem file is never reparsed or reformatted. A save
 * truncates the file at the marker below and rewrites only what follows it, so
 * the French text, the wordGroups and the two public-domain translations are
 * byte-for-byte untouched — including the stray U+FEFF characters and escaped
 * quotes a few of them carry.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const LANGS = ['en-bravo', 'es-bravo'];
const LANG_NAMES = { 'en-bravo': 'English (Bravo)', 'es-bravo': 'Español (Bravo)' };

/* Everything from this marker to the end of a poem file belongs to the tool. */
const MARKER = '/* --- Translations by Bravo';
const MARKER_COMMENT =
  '/* --- Translations by Bravo, and the backdrop ----------------------------\n' +
  '   Machine-managed by localhost edit mode (tools/dev-server.mjs). Everything\n' +
  '   from this marker to the end of the file is rewritten wholesale on save.\n' +
  '   Do not hand-edit below this line, and do not append anything after it. */\n';

const PORT = Number(
  (process.argv.find((a) => a.startsWith('--port=')) || '').split('=')[1] ||
  (process.argv[process.argv.indexOf('--port') + 1] || '').match(/^\d+$/)?.[0] ||
  process.env.PORT ||
  8181
);

/* --- Poem files ---------------------------------------------------------- */

/* Poems live one per file in the numbered section directories. The id is the
   basename, and also the key the file registers itself under. */
function scanPoems() {
  const map = new Map();
  for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory() || !/^\d+\. /.test(dir.name)) continue;
    for (const f of fs.readdirSync(path.join(ROOT, dir.name))) {
      if (f.endsWith('.js')) map.set(f.slice(0, -3), path.join(ROOT, dir.name, f));
    }
  }
  return map;
}

let poemFiles = scanPoems();

const ASSETS = path.join(ROOT, 'assets');

/* A path written the way the site writes one: relative to the root, forward
   slashes, so it can be joined to `data-base` in the browser. */
function rel(full) {
  return path.relative(ROOT, full).split(path.sep).join('/');
}

function fileFor(poemId) {
  if (!/^[a-z0-9-]+$/.test(poemId)) return null;
  if (!poemFiles.has(poemId)) poemFiles = scanPoems();   /* a poem added since startup */
  return poemFiles.get(poemId) || null;
}

/* Run the file the way the browser does — it is a plain assignment into a
   `window` we supply — and read back what it registered. This is the authority
   the client's line count is checked against. */
function loadPoem(file) {
  const src = fs.readFileSync(file, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { filename: file, timeout: 5000 });
  const poems = sandbox.window.POEMS || {};
  const id = Object.keys(poems)[0];
  return { id, poem: poems[id] || null, src };
}

/* --- Images --------------------------------------------------------------- */

/* What the backdrop picker offers. Found by looking rather than kept in a
   list somebody has to remember, so dropping a photograph into assets/ is the
   whole of adding one. A thumbs/ directory beside an image is used for the
   strip, as the thirteen nightscapes have one; an image with no thumbnail shows
   itself instead. */
const IMAGE_EXT = /\.(?:jpe?g|png|webp|avif)$/i;

function scanImages() {
  const found = [];
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'thumbs') walk(full);
        continue;
      }
      if (!IMAGE_EXT.test(entry.name)) continue;
      const stem = entry.name.replace(/\.[^.]+$/, '');
      const thumb = path.join(dir, 'thumbs', stem + '.jpg');
      found.push({
        path: rel(full),
        thumb: fs.existsSync(thumb) ? rel(thumb) : null,
        label: stem.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase())
      });
    }
  })(ASSETS);
  /* The photographs meant to be looked at are the ones somebody cropped a
     thumbnail for; the loose textures at the top of assets/ come after them,
     so the strip opens on the thirteen nightscapes rather than on paper.png. */
  return found.sort((a, b) => (b.thumb ? 1 : 0) - (a.thumb ? 1 : 0));
}

let imageFiles = null;

/* --- Serialising ---------------------------------------------------------- */

/* Double quotes and literal UTF-8, as every poem file is written: only the
   backslash, the quote and the characters that would genuinely break a line
   are escaped. */
function jsString(value) {
  return '"' + String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029') + '"';
}

/* Everything the tool owns in a poem file: the translations, and the backdrop.
   Two statements under one marker, either of which may be absent — and when
   both are, so is the marker, so a poem nobody has authored anything for keeps
   a file that ends where its curated data ends. */
function renderTail(poemId, bravo, backdrop) {
  const langs = LANGS.filter((l) => bravo && bravo[l]);
  const layers = BACKDROP_LAYERS.filter((k) => backdrop && backdrop[k] && backdrop[k].image);
  if (!langs.length && !layers.length) return '';

  let out = '\n' + MARKER_COMMENT;
  if (langs.length) out += `window.POEMS[${jsString(poemId)}].bravo = {\n`;
  for (const lang of langs) {
    const e = bravo[lang];
    out += `  ${jsString(lang)}: {\n`;
    out += `    status: ${jsString(e.status)},\n`;
    out += `    title: ${jsString(e.title || '')},\n`;
    out += '    lines: [\n';
    for (const line of e.lines) out += `      ${jsString(line)},\n`;
    out += '    ],\n';
    /* word pairs: the curated group's wid -> this translation's words */
    const wids = e.groups ? Object.keys(e.groups) : [];
    if (wids.length) {
      out += '    groups: {\n';
      for (const wid of wids) out += `      ${jsString(wid)}: ${jsString(e.groups[wid])},\n`;
      out += '    },\n';
    }
    out += '  },\n';
  }
  if (langs.length) out += '};\n';

  if (layers.length) {
    if (langs.length) out += '\n';
    out += `window.POEMS[${jsString(poemId)}].backdrop = {\n`;
    for (const key of layers) {
      const layer = backdrop[key];
      out += `  ${key}: { image: ${jsString(layer.image)}, opacity: ${layer.opacity} },\n`;
    }
    out += '};\n';
  }
  return out;
}

/* The truncation the whole format rests on: everything from the marker down is
   ours to rewrite, everything above it is the curated poem and is never so
   much as reparsed. Both save paths come through here, and each passes the
   other's half back unchanged — writing a backdrop must not cost a
   translation, or the other way about. */
function writeTail(file, src, poemId, { bravo, backdrop }) {
  const cut = src.indexOf(MARKER);
  const kept = (cut === -1 ? src : src.slice(0, cut)).replace(/\s*$/, '\n');

  /* via a temp file, so a crash mid-write cannot leave half a poem behind */
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, kept + renderTail(poemId, bravo, backdrop), 'utf8');
  fs.renameSync(tmp, file);
}

/* --- Saving --------------------------------------------------------------- */

class BadRequest extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

/* Validate a submitted translation and write it into the poem file. Returns
   what was written, so the caller can report it or commit it. */
function saveTranslation({ poemId, lang, title, lines, status }) {
  const file = fileFor(poemId);
  if (!file) throw new BadRequest(`No poem file for id "${poemId}".`, 404);
  if (!LANGS.includes(lang)) throw new BadRequest(`Unknown language "${lang}".`);
  if (!['draft', 'complete'].includes(status)) throw new BadRequest(`Unknown status "${status}".`);
  if (!Array.isArray(lines) || lines.some((l) => typeof l !== 'string')) {
    throw new BadRequest('`lines` must be an array of strings.');
  }

  const { poem, src } = loadPoem(file);
  if (!poem || !Array.isArray(poem.segments)) {
    throw new BadRequest(`${path.basename(file)} did not register a poem with segments.`, 500);
  }

  /* The grid pairs line i to line i. A translation of a different length would
     silently misalign the whole poem, so it is refused rather than padded. */
  const total = poem.segments.length;
  if (lines.length !== total) {
    throw new BadRequest(`Expected ${total} lines to match the French, got ${lines.length}.`);
  }

  const cleaned = lines.map((l) => l.replace(/\s+/g, ' ').trim());
  const translated = cleaned.filter(Boolean).length;
  const cleanTitle = String(title || '').trim();

  if (status === 'complete') {
    if (translated < total) {
      const blank = cleaned.findIndex((l) => !l) + 1;
      throw new BadRequest(
        `Not fully translated: ${translated} of ${total} lines, first gap at line ${blank}.`
      );
    }
    if (!cleanTitle) throw new BadRequest('A finished translation needs a title.');
  }

  const bravo = Object.assign({}, poem.bravo);
  if (translated === 0 && !cleanTitle) {
    delete bravo[lang];                       /* an abandoned draft leaves no stub */
  } else {
    bravo[lang] = { status, title: cleanTitle, lines: cleaned };
    /* Word pairs are not edited here, so the ones already on file are kept —
       except where the line they belong to no longer contains their words,
       which is what a pair going stale looks like. */
    const had = poem.bravo && poem.bravo[lang] && poem.bravo[lang].groups;
    if (had) {
      const groups = {};
      for (const [wid, text] of Object.entries(had)) {
        const line = cleaned[Number(wid.split('-')[0])] || '';
        if (text && line.includes(text)) groups[wid] = text;
      }
      if (Object.keys(groups).length) bravo[lang].groups = groups;
    }
  }

  writeTail(file, src, poemId, { bravo, backdrop: poem.backdrop });

  return { file: path.relative(ROOT, file), status, translated, total, title: cleanTitle };
}

/* --- Backdrops ------------------------------------------------------------ */

const BACKDROP_LAYERS = ['page', 'poem'];

/* An image path is checked three ways before it is written into a poem file:
   it must look like one, it must not climb out of assets/ once resolved, and
   the file must actually be there. The regex alone is not enough — ".." is
   made of characters it allows. */
const IMAGE_PATH = /^assets\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\.(?:jpe?g|png|webp|avif)$/;

function cleanLayer(layer, which) {
  if (layer == null) return null;
  if (typeof layer !== 'object') throw new BadRequest(`\`${which}\` must be an object or null.`);

  const image = String(layer.image || '');
  if (!image) return null;                 /* a layer with no image is no layer */
  if (!IMAGE_PATH.test(image) || image.split('/').includes('..')) {
    throw new BadRequest(`"${image}" is not an image path under assets/.`);
  }
  const full = path.resolve(ROOT, image);
  if (!full.startsWith(ASSETS + path.sep) || !fs.existsSync(full)) {
    throw new BadRequest(`No such image: ${image}`, 404);
  }

  const opacity = Number(layer.opacity);
  if (!Number.isFinite(opacity)) throw new BadRequest(`\`${which}.opacity\` must be a number.`);
  return { image, opacity: Math.round(Math.min(1, Math.max(0, opacity)) * 100) / 100 };
}

/* The backdrop is a property of the poem, not of a translation: one choice per
   layer, the same in every language. */
function saveBackdrop({ poemId, page, poem }) {
  const file = fileFor(poemId);
  if (!file) throw new BadRequest(`No poem file for id "${poemId}".`, 404);

  const { poem: onDisk, src } = loadPoem(file);
  if (!onDisk) throw new BadRequest(`${path.basename(file)} did not register a poem.`, 500);

  const backdrop = {};
  const layers = { page: cleanLayer(page, 'page'), poem: cleanLayer(poem, 'poem') };
  for (const key of BACKDROP_LAYERS) if (layers[key]) backdrop[key] = layers[key];

  writeTail(file, src, poemId, { bravo: onDisk.bravo, backdrop });

  return { file: path.relative(ROOT, file), backdrop };
}

/* --- Git ------------------------------------------------------------------ */

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function gitStatus() {
  try {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
    const dirty = git(['status', '--porcelain']).split('\n').filter(Boolean).length;
    return { isRepo: true, branch, dirty };
  } catch {
    return { isRepo: false, branch: null, dirty: 0 };
  }
}

/* --- HTTP ----------------------------------------------------------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store'
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) { reject(new BadRequest('Request too large.', 413)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new BadRequest('Body was not valid JSON.')); }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/edit/status' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, root: ROOT, langs: LANGS, git: gitStatus() });
  }

  if (url.pathname === '/api/edit/poem' && req.method === 'GET') {
    const id = url.searchParams.get('id') || '';
    const file = fileFor(id);
    if (!file) throw new BadRequest(`No poem file for id "${id}".`, 404);
    const { poem } = loadPoem(file);
    return sendJson(res, 200, {
      ok: true,
      file: path.relative(ROOT, file),
      segmentCount: poem?.segments?.length ?? 0,
      title: poem?.title || '',
      bravo: poem?.bravo || {},
      backdrop: poem?.backdrop || null
    });
  }

  /* Rescanned when the picker asks and the list is stale — dropping a
     photograph into assets/ should not mean restarting the server. */
  if (url.pathname === '/api/edit/images' && req.method === 'GET') {
    if (!imageFiles || url.searchParams.get('rescan')) imageFiles = scanImages();
    return sendJson(res, 200, { ok: true, images: imageFiles });
  }

  if (url.pathname === '/api/edit/save' && req.method === 'POST') {
    const body = await readBody(req);
    return sendJson(res, 200, Object.assign({ ok: true }, saveTranslation(body)));
  }

  if (url.pathname === '/api/edit/backdrop' && req.method === 'POST') {
    const body = await readBody(req);
    return sendJson(res, 200, Object.assign({ ok: true }, saveBackdrop(body)));
  }

  if (url.pathname === '/api/edit/commit' && req.method === 'POST') {
    const body = await readBody(req);
    const status = gitStatus();
    if (!status.isRepo) throw new BadRequest('This folder is not a git repository.', 409);

    const saved = saveTranslation(Object.assign({}, body, { status: 'complete' }));
    const name = LANG_NAMES[body.lang] || body.lang;
    const { poem } = loadPoem(fileFor(body.poemId));
    const message = body.message || `Add ${name} translation of ${poem?.title || body.poemId}`;

    try {
      git(['add', '--', saved.file]);
      git(['commit', '-m', message]);
    } catch (e) {
      const out = (e.stdout || '') + (e.stderr || '');
      throw new BadRequest(
        /nothing to commit/i.test(out)
          ? 'Nothing to commit — this translation is already committed.'
          : `git refused the commit: ${out.trim().split('\n')[0] || e.message}`,
        409
      );
    }

    return sendJson(res, 200, Object.assign({ ok: true, message }, saved, {
      commit: git(['rev-parse', '--short', 'HEAD'])
    }));
  }

  throw new BadRequest('No such endpoint.', 404);
}

function serveStatic(req, res, url) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400).end('Bad path'); return; }
  if (pathname === '/') pathname = '/index.html';

  const full = path.resolve(ROOT, '.' + pathname);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  if (path.relative(ROOT, full).split(path.sep)[0] === '.git') { res.writeHead(403).end('Forbidden'); return; }

  let stat;
  try { stat = fs.statSync(full); } catch { res.writeHead(404).end('Not found'); return; }

  /* A generated poem page is a directory with an index.html in it, and that is
     the address the site now uses — /poems/une-charogne/. Serve it the way a
     static host would, so what is tested here is what is deployed. */
  if (stat.isDirectory()) {
    const index = path.join(full, 'index.html');
    let indexStat;
    try { indexStat = fs.statSync(index); } catch { res.writeHead(403).end('Forbidden'); return; }
    if (!indexStat.isFile()) { res.writeHead(403).end('Forbidden'); return; }
    /* Without the trailing slash the page's relative links would resolve one
       level too high, so send the browser to the canonical form first. */
    if (!url.pathname.endsWith('/')) {
      res.writeHead(301, { Location: url.pathname + '/' + url.search }).end();
      return;
    }
    return sendFile(res, index, indexStat);
  }

  return sendFile(res, full, stat);
}

function sendFile(res, full, stat) {
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    /* the whole point is to see an edit on reload */
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(full).pipe(res);
}

const server = http.createServer(async (req, res) => {
  /* Only ever addressed as localhost. Cheap guard against a rebound DNS name
     pointing a browser somewhere else at a server that writes files. */
  const host = (req.headers.host || '').split(':')[0].replace(/^\[|\]$/g, '');
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    res.writeHead(403).end('Reachable as localhost only.');
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) sendJson(res, e.status || 500, { ok: false, error: e.message });
    else res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const g = gitStatus();
  console.log(`Les Fleurs du mal — editing at http://localhost:${PORT}/`);
  console.log(`  ${poemFiles.size} poems in ${ROOT}`);
  console.log(g.isRepo ? `  git: on ${g.branch}, ${g.dirty} file(s) changed` : '  git: not a repository — commit is unavailable');
});
