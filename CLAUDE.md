# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static website for viewing Charles Baudelaire's *Les Fleurs du mal* with side-by-side aligned translations (French, English, Spanish). No build system, no bundler, no framework — just vanilla HTML/CSS/JS opened directly in a browser.

## Running

Open `index.html` in a browser. No server required (all file:// compatible). The URL hash is the route: a poem id (e.g. `#une-charogne`), `#home` or `#about`.

## Architecture

**Poem data files** — Each poem is a standalone `.js` file in a numbered section directory (e.g. `1. Spleen et Ideal/une-charogne.js`). Each file self-registers into `window.POEMS[id]` with `title`, `titles` (per-language), `segments` (line-by-line translations), and `blocks` (stanza/blank pattern). These are loaded via `<script>` tags in `index.html` before `translation-data.js`.

**`translation-data.js`** — Bootstrap file that defines poem display order and sets initial globals (`window.POEM_IDS`, `window.CURRENT_POEM_ID`, `window.TRANSLATION_SEGMENTS`, `window.TRANSLATION_BLOCKS`). Poems not in the `order` array won't appear in navigation.

**`translation.js`** — All UI logic: builds the two-column comparison grid, the home page extract, sidebar navigation, poem switching, translation language dropdown, line hover/selection highlighting, font size, and dark mode. Contains a hardcoded `POEM_SECTIONS` map that assigns each poem ID to a sidebar section (`data-section`). Owns the three views and the hash routing between them (see *Views* below), and the two sidebar modes (see *Responsive layout* below): the `sidebar-hidden` body class is the remembered wide-screen collapse, `sidebar-open` is the narrow-screen drawer, and `syncSidebarMode()` keeps exactly one of them live for the current width.

**`search.js`** — Unified backend-free search over every loaded poem. Builds its index lazily from `window.POEMS` on first open: each title and line is "folded" once (lowercased, accents stripped, `œ`/`æ`/`ß` expanded, curly quotes and dashes normalised), so a query matches regardless of language or accents (`ame` → `âme`, `corazon` → `corazón`, `coeur` → `cœur`). A poem qualifies when every query term appears somewhere in it; title hits outrank line hits. Opens as a palette on Ctrl/Cmd+K, `/`, or either search trigger (`.sidebar-search` in the sidebar, `.topbar-search` on narrow screens), and reaches back into the page through `window.FLOWERS` (see below). Section labels in results are read from the sidebar markup rather than duplicating `POEM_SECTIONS`.

**`window.FLOWERS`** — The only public surface of `translation.js`, exposed for `search.js`: `switchPoem(id)`, `setTranslationLang(lang)` (drives the translation column as the dropdown would), `getTranslationLang()`, `focusLine(tid)` (scrolls a line into view in both columns and flashes it via `.translation-search-flash`), and `closeSidebar()` (dismisses the narrow-screen drawer so the palette is not covering an open drawer).

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

Three views share `index.html`; `data-view` on `<body>` decides which one the
stylesheet reveals, and the hash is the address:

- `#<poem-id>` — the reader (header, comparison grid, prev / random / next)
- `#home` — landing page: what the site does, and the *Start reading* and
  *A poem at random* buttons
- `#about` — the project and its author

`applyRoute()` in `translation.js` runs on load and on `hashchange`, so Back and
Forward move between poems and pages. An unrecognised hash — including none at
all, i.e. a first visit — lands on `#home`. The static views never write the hash
themselves: they are only reached from it, since the sidebar title and the About
link at the foot of the sidebar are plain anchors. A small inline script at the
top of `<body>` sets `data-view` before paint so a deep link never flashes the
reader first.

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
page's list, which names them for the reader.

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

## Adding a New Poem

1. Create `<section-dir>/<poem-id>.js` following the pattern in existing files (see README.md for full data model)
2. Add a `<script>` tag for it in `index.html` **before** `translation-data.js`
3. Add the poem ID to the `order` array in `translation-data.js`
4. Add a `'<poem-id>': '<section>'` entry in the `POEM_SECTIONS` map in `translation.js` (line ~13)

Search needs no step of its own: it indexes whatever is in `window.POEMS`.

Key constraints:
- Segment `id` values must be 0-based sequential with no gaps
- `blocks` alternates `{type:'stanza', lines:N}` and `{type:'blank'}` entries
- `lines` declares that stanza's real length, so a poem can mix stanza sizes
  (sonnets are `4,4,3,3`). Omit `lines` and the renderer falls back to
  `data-lines-per-stanza` on `.comparison` (default 4) — the 17 oldest poem
  files rely on that fallback.
- Poems written in numbered parts (Le Voyage, Le Cygne, ...) use
  `{type:'part', label:'II'}` blocks, rendered as a centered numeral row.

Adding a poem is scripted rather than hand-written: the French text comes from
the 1861 edition on fr.wikisource.org (`Les Fleurs du mal (1861)/<Title>`).

## Translations and copyright

Only public-domain translations are carried: **Cyril Scott** (1909, Project
Gutenberg #36098) for English and **Eduardo Marquina** (1905, es.wikisource) for
Spanish. Scott rendered 50 of these poems and Marquina's attributed pages cover
114, so most poems ship French-only.

A poem simply omits the `en` / `es` key on every segment when no free translation
exists; `poemHasLang()` in `translation.js` spots that and the column renders the
`.translation-missing` note instead of verse. A language is all-or-nothing per
poem — half a column would mis-pair lines against the French.

Two rules when adding a translation:

- **Verify the translator is public domain.** Wikisource pages without a
  `traductor=` field or a signed credit line are treated as unverified and get the
  placeholder. Modern translations (Roy Campbell, Richard Howard, James McGowan,
  …) are still in copyright and must not be added.
- **Verify the line counts match the French exactly.** The grid pairs line *i* to
  line *i*; a translation that condenses or expands lines would silently misalign
  the whole poem.

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
