/**
 * Local authoring server for edit mode.  `node tools/dev-server.mjs`
 *
 * The site itself needs no server — it is opened as a file and always will be.
 * This exists for one reason: a browser cannot write to disk, and edit mode
 * has to put the translation you type into the poem's own `.js` file. So it
 * serves the site over http on 127.0.0.1 (which is also what makes edit mode
 * appear at all — see the guard at the top of index.html) and adds four
 * endpoints under /api/edit for reading, saving and committing.
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
  '/* --- Translations by Bravo ---------------------------------------------\n' +
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

function renderBlock(poemId, bravo) {
  const langs = LANGS.filter((l) => bravo[l]);
  if (!langs.length) return '';

  let out = '\n' + MARKER_COMMENT;
  out += `window.POEMS[${jsString(poemId)}].bravo = {\n`;
  for (const lang of langs) {
    const e = bravo[lang];
    out += `  ${jsString(lang)}: {\n`;
    out += `    status: ${jsString(e.status)},\n`;
    out += `    title: ${jsString(e.title || '')},\n`;
    out += '    lines: [\n';
    for (const line of e.lines) out += `      ${jsString(line)},\n`;
    out += '    ],\n';
    out += '  },\n';
  }
  out += '};\n';
  return out;
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
  }

  const cut = src.indexOf(MARKER);
  const kept = (cut === -1 ? src : src.slice(0, cut)).replace(/\s*$/, '\n');
  const out = kept + renderBlock(poemId, bravo);

  /* via a temp file, so a crash mid-write cannot leave half a poem behind */
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, out, 'utf8');
  fs.renameSync(tmp, file);

  return { file: path.relative(ROOT, file), status, translated, total, title: cleanTitle };
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
      bravo: poem?.bravo || {}
    });
  }

  if (url.pathname === '/api/edit/save' && req.method === 'POST') {
    const body = await readBody(req);
    return sendJson(res, 200, Object.assign({ ok: true }, saveTranslation(body)));
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
