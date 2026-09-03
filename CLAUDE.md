# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static website for viewing Charles Baudelaire's *Les Fleurs du mal* with side-by-side aligned translations (French, English, Spanish). No bundler, no framework — just vanilla HTML/CSS/JS opened directly in a browser.

The one build step is `node tools/build-pages.mjs`, which gives each poem a page
of its own so that a search engine can index it. It generates from `index.html`
rather than replacing it, needs no dependencies, and the site still opens
straight off disk. See *Addresses and generated pages*.

## Running

Open `index.html` in a browser. No server required (all file:// compatible).
The path is the route: `/poems/<id>/` for a poem, `/about/`, `/` for home. Those
pages are generated — run `node tools/build-pages.mjs` after adding a poem — and
the old hash form (`#une-charogne`) still resolves, to the real address. See
*Addresses and generated pages* below.

The one exception is *Edit mode*, which needs somewhere to write to:
`node tools/dev-server.mjs`, then `http://localhost:8181/`. That serves the same
static files, and nothing about the site changes — it just makes the authoring
tool available. See *Edit mode* below.

On Windows, `.\dev.ps1` does that in one step: it starts the server and opens
the browser once the server actually answers. `-Port` moves it, `-NoBrowser`
skips the window, Ctrl+C stops it. If a server is already up on that port it
opens the browser at that one rather than starting a second — two editing tabs
on one poem would race on the same file.

## Architecture

**Poem data files** — Each poem is a standalone `.js` file in a numbered section directory (e.g. `1. Spleen et Ideal/une-charogne.js`). Each file self-registers into `window.POEMS[id]` with `title`, `titles` (per-language), `segments` (line-by-line translations), and `blocks` (stanza/blank pattern). These are loaded via `<script>` tags in `index.html` before `translation-data.js`.

**`translation-data.js`** — Bootstrap file that defines poem display order and sets initial globals (`window.POEM_IDS`, `window.CURRENT_POEM_ID`, `window.TRANSLATION_SEGMENTS`, `window.TRANSLATION_BLOCKS`). Poems not in the `order` array won't appear in navigation.

**`translation.js`** — All UI logic: builds the two-column comparison grid, the home page extract, sidebar navigation, poem switching, translation language dropdown, line hover/selection highlighting, font size, and dark mode. Contains a hardcoded `POEM_SECTIONS` map that assigns each poem ID to a sidebar section (`data-section`). Owns the three views and the routing between them (see *Views* and *Addresses
and generated pages* below), and the two sidebar modes (see *Responsive layout* below): the `sidebar-hidden` body class is the remembered wide-screen collapse, `sidebar-open` is the narrow-screen drawer, and `syncSidebarMode()` keeps exactly one of them live for the current width.

**`search.js`** — Unified backend-free search over every loaded poem. Builds its index lazily from `window.POEMS` on first open: each title and line is "folded" once (lowercased, accents stripped, `œ`/`æ`/`ß` expanded, curly quotes and dashes normalised), so a query matches regardless of language or accents (`ame` → `âme`, `corazon` → `corazón`, `coeur` → `cœur`). A poem qualifies when every query term appears somewhere in it; title hits outrank line hits. Opens as a palette on Ctrl/Cmd+K, `/`, or either search trigger (`.sidebar-search` in the sidebar, `.topbar-search` on narrow screens), and reaches back into the page through `window.FLOWERS` (see below). Section labels in results are read from the sidebar markup rather than duplicating `POEM_SECTIONS`.

**`window.FLOWERS`** — The only public surface of `translation.js`, exposed for `search.js` and `edit.js`: `switchPoem(id)`, `setTranslationLang(lang)` (drives the translation column as the dropdown would), `getTranslationLang()`, `focusLine(tid)` (scrolls a line into view in both columns and flashes it via `.translation-search-flash`), and `closeSidebar()` (dismisses the narrow-screen drawer so the palette is not covering an open drawer). Edit mode additionally uses `getPoemId()`, `getPoem()`, `availableTranslationLangs()`, `rebuild()` (tear the grid down and build it again from whatever `window.POEMS` now says) and `setPoemTitle()`. Every caller feature-detects, so a missing method degrades rather than throws.

**`bravo.js`** — Folds the site's own translations into the ordinary data
model. A poem file may end with a machine-managed block (`window.POEMS[id].bravo`)
holding a `status`, a `title` and a `lines` array index-aligned with `segments`;
this file copies those lines onto the segments as `en-bravo` / `es-bravo`, so
everything downstream treats them as just another language. It also decides who
sees what: `window.BRAVO.langsFor(id)` names only the translations marked
complete — which is what the dropdown and the search index are built from —
while `all(id)` includes drafts, which only edit mode asks for. Loaded between
`translation-data.js` and `translation.js`. See *Edit mode* below.

**`syllables.js` / `en-syllables.js`** — Metrical syllable counting, for the
count gutters in edit mode. Loaded only on localhost, beside `edit.js`. It
counts the way a poet counts rather than the way a dictionary hyphenates —
French mute e elides before a vowel and never sounds at the end of a line,
Spanish runs a word-final vowel into the next word's initial one and then
measures to the last stress — which is why no hyphenation library appears here.
`scan(line, lang)` returns `{count, min, max, unsure, parts}`: it is a segmenter,
so the count is `parts.length` and the pieces go in the tooltip, and a line
classical usage lets you read two ways says so through `unsure` rather than
asserting one. `meter(lines, lang)` gives the count most of a poem's lines agree
on. `en-syllables.js` is generated and carries the ~15k English words the rules
get wrong. See *Syllable counting* below.

**`edit.js` / `edit.css` / `tools/dev-server.mjs`** — Edit mode. Never fetched by
a published copy of the site; see *Edit mode* below.

**`site-lang.js`** — Resolves the language the two written pages are shown in
(`en` / `es`) and sets `data-lang` on `<body>`. Loaded as the first thing inside
`<body>`, before those pages are parsed, so neither language ever blinks past
the other. Resolution order: a value already in `localStorage`, then
`navigator.languages`, then the time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`
against a list of Spanish-speaking zones), then `en`. Whatever it resolves to is
written straight back to `localStorage`, so a reload never resolves again — and
a reader who picks the other language keeps it. Exposes
`window.SITE_LANG`: `get()`, `set(lang)`, `onChange(fn)` and
`pick({en, es})`. It owns only the resolving and the storing; the DOM side —
the toggle, and what follows a change — lives in `translation.js`.

**`meta.js`** — What a page says about itself: its title, its description and
its schema.org graph, worked out from a poem's own data. Two callers need
byte-identical answers — `tools/build-pages.mjs`, writing them into each
generated page, which is what a crawler and a link preview read, and
`translation.js`, rewriting them in the browser when a reader moves between
poems without a page load — so the strings live here once and both sides call
them. Nothing in it touches the DOM (the one piece of page context it needs, a
poem's section name, is passed in), which is what lets the build script load it
under `node:vm` the way it loads the poem files. Loaded between `bravo.js` and
`translation.js`.

**`styles.css`** — Complete styling including dark mode (`[data-theme="dark"]`), font size variants (`[data-font-size]`), and responsive layout.

## Responsive layout

Layout tokens on `:root` (`--sidebar-w`, `--drawer-w`, `--content-max`, `--gutter`,
`--cell-pad-x`, `--num-col`) carry the sizes; the *Responsive layout* section at the
foot of `styles.css` mostly retunes those tokens rather than restating the rules that
consume them. Prefer adding a token over duplicating a rule inside a media query.

Four regimes:

- **≥ 1151px** — French and the translation side by side. Two verse columns need
  roughly this much before each is wide enough to hold an alexandrine, so the split
  sits here; padding starts narrow at the threshold and widens as room appears.
- **≤ 1150px** — the columns interleave into one book-width column: each French
  stanza followed by its translation, tinted with a left rule so the pair reads as
  one unit. `.comparison` becomes `display: block`, which leaves the `grid-row` /
  `grid-column` the renderer sets inert, so cells simply fall in document order.
- **≤ 900px** — the sidebar stops being a rail and becomes a drawer over the page,
  driven by `.topbar` (menu, poem title, search). The scrim, `Escape`, picking a
  poem, and opening the palette all close it.
- **≤ 480px** — phone: 16px base type, full-bleed comparison card, prev/next
  buttons without titles.

Overlays (search palette, Wiktionary lookup) become full-height / bottom sheets at
≤ 700px, `@media (pointer: coarse)` enlarges hit areas, and `env(safe-area-inset-*)`
keeps the bar, drawer and sheets clear of notches.

Because the stacked layout hides rows that only exist to align two columns, the
renderer tags them: blank spacer rows get `cell-blank` and part-numeral rows get
`cell-part` (the translation copy of a numeral is hidden, the French one centres).

## Views

Three views share one document; `data-view` on `<body>` decides which one the
stylesheet reveals, and the path is the address:

- `/poems/<poem-id>/` — the reader (header, comparison grid, prev / random / next)
- `/` — landing page: what the site does, and the *Start reading* and
  *A poem at random* buttons
- `/about/` — the project and its author

Each of those is a real page on disk, generated from `index.html`; see
*Addresses and generated pages*. The old `#<poem-id>` / `#home` / `#about` form
still resolves, and `applyRoute()` replaces it with the real address so a poem
never has two.

`applyRoute()` in `translation.js` runs on load and on `popstate` (and still on
`hashchange`, for links written before the poems had addresses), so Back and
Forward move between poems and pages. An unrecognised address lands on home. A
small inline script at the top of `<body>` sets `data-view` before paint so a
deep link never flashes the reader first — though a generated page already
carries the right `data-view` in its markup, so it only has anything to decide
at the root.

Both ways to a poem at random — the button beside *Start reading* on home and
the middle seat of the reader's own nav — carry the class `.random-poem` and are
bound once in `initRoutes()`. `getRandomPoemId()` never returns the poem already
open, since landing back on the same page reads as a button that did nothing.

The home and about copy lives in `index.html` as `#view-home` / `#view-about`,
written twice over: every translatable run of prose appears once in a
`.lang-en` element and once in a `.lang-es` one, and `styles.css` hides the
language `data-lang` does not name. Only the hiding is declared, so a shown
`<span>` stays inline and a shown `<div>` stays a block. Both pages carry the
same `.static-langs` toggle above the title; `initLangToggles()` keeps the two
copies of it in step and, on a change, re-titles the page, re-labels the extract
and points the translation column at the new language. The cascade runs one way
only: the page language sets the column, the dropdown never sets the page.

A term in that copy that needs a sentence behind it — *pièces condamnées* on
home — is written as `.glossary`: a `.glossary-term` button carrying
`popovertarget`, followed by a `.glossary-note` with the `popover` attribute.
The browser owns the toggle, `Escape` and click-away; `initGlossary()` in
`translation.js` owns only the placing (under the term, flipped above it when
there is no room, re-placed while it is up). Each language's copy carries its
own note, since both are in the document at once and ids must differ. Where
`popover` is unsupported the note stays `display: none` and the sentence still
reads whole.

The reader's own chrome (column titles, prev/next, the search palette,
the Wiktionary panel) stays in English — nothing of it is on screen while a
written page is up, apart from the sidebar's *Search* and *About* labels, which
are bilingual for that reason.

Strings the pages build in script rather than carry in markup — the About
title, the extract's *Read … in full* caption — live in `UI_TEXT` in
`translation.js` and are read through `t()`.

**Privacy notice.** `.privacy-bar` sits outside the three views, fixed to the
foot of the window on a first visit. Nothing is collected and no cookie is set,
so it states that rather than asking consent for it, and links to the *Privacy*
section of About for the full statement (what is kept in `localStorage`, and the
two third parties a page load reaches: Google Fonts and Wiktionary). Dismissing
it is remembered under `flowers-privacy-ack`, and while it is up the page is
padded by the bar's measured height (`--privacy-bar-h`), since the text wraps to
three lines on a phone.

Everything persisted is a preference, on the reader's own device, under one of:
`flowers-lang`, `flowers-theme`, `flowers-font-size`, `flowers-sidebar-hidden`,
`flowers-sidebar-collapsed`, `flowers-privacy-ack`. Anything new that must
survive a reload belongs in `localStorage` beside them — and in the About
page's list, which names them for the reader. (A seventh key,
`flowers-edit-mode`, is written only by edit mode, which no reader can reach; it
is therefore not in the About list, since a reader will never have one.)

Home also carries a live extract: `<figure class="demo">` in `#view-home`, filled
by `buildDemo()` from the poem named in `data-demo-poem` (`data-demo-from` /
`data-demo-lines` say which lines). It is built out of the reader's own parts —
the same `.translation-segment` / `.word-group` markup, `delegateHover()` and the
Wiktionary click — so line highlighting, word pairing and the lookup behave there
exactly as they do below; only its tids and wids are prefixed `demo-`, since
reader and extract share one document and a highlight in one must not reach into
the other. Its two language buttons and the reader's dropdown stay in step both
ways (`setTranslationLang()` and `syncDemoLang()`), so a poem opens in the
language the extract was left in. It is always laid out interleaved: an
alexandrine needs more than half the prose measure, so two columns would only
wrap.

## Addresses and generated pages

Every poem has a URL of its own. This matters for one reason: a search engine
treats `#une-charogne` and `#le-vampire` as the same page, so under the old
hash-only scheme all 133 poems competed for a single result.

    /                        home
    /about/                  about
    /poems/une-charogne/     one poem

`tools/build-pages.mjs` writes those out — 133 poem pages, the about page,
`sitemap.xml` and `robots.txt` — **from `index.html` itself**, so there is no
second copy of the markup to keep in step. Re-run it after adding a poem, after
editing the head of `index.html`, or after changing anything it mirrors
(`meta.js`, the grid renderer, `POEM_SECTIONS`). It is idempotent, and it clears
`poems/` and `about/` first so a renamed poem leaves no page behind.

Each generated page is still **the whole site** — same sidebar, same search,
same reader — so arriving from a search result and arriving from the sidebar are
the same thing. What it adds is:

- its own title, description, canonical URL, Open Graph / Twitter card and
  schema.org graph (`Poem`, the `Book` it belongs to, and a `BreadcrumbList`),
  all of them from `meta.js`;
- **the poem already rendered into the HTML**, so a crawler that runs no
  JavaScript still reads the verse, and so something paints before a megabyte of
  poem data has arrived. `buildComparison()` clears the container and replaces
  it with the interactive grid as soon as it runs;
- the sidebar pre-filled with all 133 links, since `buildSidebar()` would
  otherwise be the only thing that ever creates them and a crawler would find
  no way from one poem to another. `index.html` gets the same treatment.

**How the three URL forms stay straight.** `data-base` on `<html>` says how far
the page sits below the root (`""` at the root, `"../../"` on a poem page) and
`poemHref()` / `homeHref()` / `aboutHref()` build every link from it. Opened off
disk there are no directory indexes, so those append `index.html`. Navigation is
a `pushState` where the browser allows one and a plain page load otherwise —
which is what keeps the site working from `file://`, where each generated page
is self-sufficient.

Two things are easy to get wrong here:

- **`pushState` resolves a relative URL against the address in the bar, not
  against the page that was loaded.** Pushing `poems/le-vampire/` while the bar
  already says `/poems/une-charogne/` yields `/poems/une-charogne/poems/le-vampire/`.
  `setUrl()` resolves against `DOC_URL`, captured at load, which also lets the
  site work served from a subdirectory.
- **A link is a link.** The sidebar entries and prev/next are real anchors with
  real `href`s, and the click handler bows out (`isPlainClick()`) for a
  modified click, so middle-click and ⌘-click open a new tab as they should.

`tools/dev-server.mjs` serves a directory's `index.html` and redirects the
missing trailing slash, so what is tested locally is what a static host will
serve.

## Adding a New Poem

1. Create `<section-dir>/<poem-id>.js` following the pattern in existing files (see README.md for full data model)
2. Add a `<script>` tag for it in `index.html` **before** `translation-data.js`
3. Add the poem ID to the `order` array in `translation-data.js`
4. Add a `'<poem-id>': '<section>'` entry in the `POEM_SECTIONS` map in `translation.js` (line ~13)
5. Run `node tools/build-pages.mjs`, which gives the poem its page and adds it
   to the sidebar of every other one and to `sitemap.xml`

Search needs no step of its own: it indexes whatever is in `window.POEMS`.

Key constraints:
- Segment `id` values must be 0-based sequential with no gaps
- `blocks` alternates `{type:'stanza', lines:N}` and `{type:'blank'}` entries
- `lines` declares that stanza's real length, so a poem can mix stanza sizes
  (sonnets are `4,4,3,3`). Omit `lines` and the renderer falls back to
  `data-lines-per-stanza` on `.comparison` (default 4), which assumes every
  stanza is the same length. Nothing relies on that fallback any more: all 872
  stanza blocks in the corpus carry their own `lines`.
- Poems written in numbered parts (Le Voyage, Le Cygne, ...) use
  `{type:'part', label:'II'}` blocks, rendered as a centered numeral row.

Adding a poem is scripted rather than hand-written: the French text comes from
the 1861 edition on fr.wikisource.org (`Les Fleurs du mal (1861)/<Title>`).

## Translations and copyright

Two translations are carried per language, kept apart by their language code.

The **third-party** ones must be public domain: **Cyril Scott** (1909, Project
Gutenberg #36098) under `en`, and **Eduardo Marquina** (1905, es.wikisource)
under `es`. Scott rendered 50 of these poems and Marquina's attributed pages
cover 114, so most poems ship French-only.

The **site's own** are original work by the author of this site, written through
edit mode and stored under `en-bravo` / `es-bravo`. The public-domain rule below
does not apply to them — they are not somebody else's text — but the line-count
rule does, and the server enforces it. They are labelled *English (Bravo)* and
*Español (Bravo)* in the dropdown, next to *English (Scott)* and
*Español (Marquina)*.

A poem simply omits the `en` / `es` key on every segment when no free translation
exists; `poemHasLang()` in `translation.js` spots that and the column renders the
`.translation-missing` note instead of verse. A language is all-or-nothing per
poem — half a column would mis-pair lines against the French.

Because Scott did 50 of these poems and Marquina 114, most have only one of the
two, and opening every poem in English would put that note where a Spanish
translation exists — on 64 poems, and it is the note rather than the verse that
a search engine would then take the page to be about. So `buildComparison()`
falls back to a language the poem actually carries. The dropdown names whichever
one that is and still offers the empty one, and the reader's own choice is
remembered separately (`preferredTranslationLang`), so one Spanish-only poem
does not leave every poem after it in Spanish. 114 of the 133 show a translation;
19 carry the French alone.

Two rules when adding somebody else's translation:

- **Verify the translator is public domain.** Wikisource pages without a
  `traductor=` field or a signed credit line are treated as unverified and get the
  placeholder. Modern translations (Roy Campbell, Richard Howard, James McGowan,
  …) are still in copyright and must not be added.
- **Verify the line counts match the French exactly.** The grid pairs line *i* to
  line *i*; a translation that condenses or expands lines would silently misalign
  the whole poem.

## Edit mode

Writing a translation of your own, line against line. It exists only on
`localhost`: the guard at the top of `<body>` in `index.html` injects `edit.js`
and `edit.css` only when the page is served over http from `localhost` /
`127.0.0.1` / `[::1]`, so a published copy never carries the authoring code, and
neither does `index.html` opened straight off disk (where the hostname is the
empty string). `edit.js` then waits for `GET /api/edit/status` to answer before
it shows anything at all.

**Running it.** `node tools/dev-server.mjs` — zero dependencies, port 8181,
bound to the loopback address, and it refuses any request that did not address
it as localhost. Then open `http://localhost:8181/`. The ✎ button joins the font
and theme buttons at the foot of the sidebar.

**What it writes.** The whole translation goes into the poem's own `.js` file, in
a delimited block appended after the curated data:

    /* --- Translations by Bravo ---
       ... do not hand-edit below this line ... */
    window.POEMS["le-chat-1"].bravo = {
      "en-bravo": { status: "draft", title: "The Cat", lines: [ ... ] }
    };

`lines` is index-aligned with `segments` and must be exactly as long; an
untranslated line is `""`. A save truncates the file at the marker and rewrites
only what follows, so the curated part is never reparsed or reformatted — the
French, the `wordGroups` and the two public-domain translations stay
byte-for-byte, stray `U+FEFF` characters and escaped quotes included.

**Draft and complete.** Typing stops and a second and a half later the whole
translation is written as a `draft`. A draft is invisible to a reader: it is
folded onto the segments like any other translation, but `BRAVO.langsFor()`
names only `complete` ones, and that is what the dropdown and the search index
read. *Mark complete & commit* flips the status and commits the poem file; the
server refuses `complete` while any line or the title is still blank, which is
what "fully translated" means here.

**The editor.** The reader's aligned grid cannot hold a text box per line, so
edit mode lays the poem out flat instead — line number, the French, the existing
Scott/Marquina line for reference, and the box. Stanza breaks and part numerals
are kept so the shape stays visible. `Enter` moves to the next line (a line of
verse is one line), `Ctrl/Cmd+S` saves now. The line count is fixed by the
French and cannot be changed here, which is what keeps the columns paired.

**Endpoints**, all under `/api/edit`: `status`, `poem?id=`, `save`, `commit`.
The server is the authority on line count — it runs the poem file in `node:vm`
the way the browser does and checks the submitted length against the real
`segments`.

**Syllable gutters.** Each row carries three counts in narrow right-hand
gutters, mirroring the line-number gutter on the left: the French, the
Scott/Marquina reference line, and what you have typed. Only the last one can
go red, and only when it is non-empty and does not match the French — a poem
not yet started must not open as a page of red, and the reference is
calibration rather than a target. Every count has a tooltip giving the split
(`nos · pé · chés · sont · tê · tus`), so a number you disagree with can be
checked. Where French allows two readings the count is dotted-underlined, and
the poem's own metre settles it when it falls in range: if a line reads as 11
or 12 and the poem is in twelves, it is twelve. The bar names the metre and how
many written lines miss it, and a *Syllables* toggle beside *Reference* turns
the whole thing off. None of it reaches `payload()` — counts are presentational,
and the save format is untouched.

**Out of scope:** `wordGroups`. A Bravo translation has none, so word-level
hover is inert for it; line-level hover still pairs the columns. One editing tab
at a time — two tabs on one poem would race on the same file.

## Syllable counting

`syllables.js` was tuned against the corpus rather than written from memory, and
that is how any change to it should be checked.

**`tools/check-meter.mjs`** — Baudelaire's metre is strict, so within a poem the
lines agree with each other, and where the counter disagrees with the poem it is
almost always the counter that is wrong. That makes 3,543 French lines a free
test set. The tool loads every poem the way the browser does (`node:vm`),
infers each poem's expected metre by bucketing lines on their stanza's length
and their position in it, and reports the agreement rate with every outlier.
French currently scores **97.4%**, and a good part of the residue is the
inference struggling with *L'Invitation au voyage*'s 5/5/7 rather than the
counter being wrong.

The same trick does **not** work for the two translations, which is worth
knowing before trusting a number from it:

- **Marquina's Spanish is not metrical at all** — his counts scatter from 11 to
  18 with no mode above 17%. `--lang es` measures Marquina, not the counter.
  Spanish rules are deterministic, so they are pinned by `tools/selftest.mjs`
  instead.
- **Scott's English is only loosely metrical**, so `--lang en` (about 60%)
  understates the counter badly. Measured properly — every distinct word Scott
  uses, against cmudict — it is **99.95%**.

**`tools/build-en-syllables.mjs`** regenerates `en-syllables.js` from the CMU
Pronouncing Dictionary: it derives each word's true count, runs our rules over
the same words, and commits only the disagreements. The rules alone reach
**87.4%**, so the file carries about 15k corrections (~130 KB). It shrinks
whenever the rules improve, which makes the number it prints a score for
`syllables.js` rather than just a byte count. Needs the network; nothing else
here does, and nothing runs it at page load.

**`tools/selftest.mjs`** — hand-verified cases for all three languages, covering
the rules the corpus cannot pin: Spanish synalepha and the aguda/esdrújula
adjustment, English silent e and `-tion`, French tréma, elision and the mute e.

Three rules worth knowing, because they are the ones that surprise:

- **A plural `-es` does not elide** before a vowel, where a bare final `-e`
  does. This was settled empirically — it moved French from 93.0% to 96.3%.
- **A verb's `-ent` does not elide either**, and it is silent outright after a
  vowel (`étaient`, `puent`) but a mute e after a consonant (`parlent`).
  Which words in `-ent` are verbs was drawn from the corpus and hand-checked,
  not guessed; the two lists sit next to the rule.
- **`-tion` is two syllables in French and one in English.** The counter parts
  company with itself here on purpose.

## Word-by-word highlighting

`wordGroups` on a segment pair a French fragment with its counterpart in each
translation, so hovering either side lights up both. A group carries `wid`
(`"<segmentId>-<n>"`), `fr`, and whichever of `en` / `es` genuinely corresponds
— Scott recasts images often enough that many groups are Spanish-only. Poems
with no translation have no groups at all.

`renderWordGroupContent()` locates a group by `indexOf` on the line, claiming
character ranges as it goes. Two consequences when adding groups by hand:

- **Every value must be an exact substring of its own line**, matching case.
- **A short form can match inside a longer word.** In *La Mort des pauvres*
  `eat` would land in "Wh*eat*" were it not for the `Où`/`Whereat` group listed
  ahead of it, which claims that span first. Group order is the fix.

The 48 original poems were annotated by hand. The 66 added ones were annotated
from their own aligned text: the curated groups act as a seed lexicon, extended
with an authored FR→ES vocabulary and French/Spanish cognacy, and every
candidate must occur in that poem's own translated line. Measured against
held-out curated lines the pairings agree ~96% of the time, at about 2.7 groups
per annotated line versus 4 for the hand-made ones — deliberately sparser,
since a wrong pairing teaches the reader the wrong word.

## Section Directories

Directories map to *Les Fleurs du mal* sections: `0. Au Lecteur/`, `1. Spleen et Ideal/`, `3. Le Vin/`, `6. La Mort/`, `7. Pieces Condamnees/`, etc. The sidebar sections in `index.html` use `data-section` attributes that must match keys in the `POEM_SECTIONS` map.

The corpus is complete: all 127 pieces of the 1861 edition (`Au lecteur` plus 126
poems) and the 6 *pièces condamnées* struck from the 1857 edition and reprinted in
*Les Épaves* (1866) — 133 files in all.
