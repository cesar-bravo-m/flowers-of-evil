## Les Fleurs du mal — data model

This project is a static viewer for a small set of Baudelaire poems, with aligned translations. Everything the UI needs lives in plain JS objects in `translation-data.js`.

### 1. Where poems live

- **File**: `translation-data.js`
- **Global object**: `window.POEMS`
- **Shape**:

```javascript
window.POEMS = {
  '<poem-id>': {
    title: 'French display title',
    titles: { fr: 'French title', en: 'English title', es: 'Spanish title' },
    segments: [ /* one entry per line */ ],
    blocks: (function () { /* stanza / blank pattern */ })(),
  },
  // more poems ...
};
```

- **Poem id** (`<poem-id>`):
  - Used in the URL hash (`#benediction`).
  - Used by navigation and the sidebar.
  - Must be **unique**, URL‑safe, and stable (e.g. `benediction`, `l-albatros`, `elevation`).

### 2. Lines / segments

- **Array**: `segments` inside each poem.
- **One object per line**:

```javascript
segments: [
  { id: 0, fr: 'French line 1', en: 'English line 1', es: 'Spanish line 1' },
  { id: 1, fr: 'French line 2', en: 'English line 2', es: 'Spanish line 2' },
  // ...
]
```

- **Rules**:
  - `id` is a **0‑based line number** and must be **sequential** (0, 1, 2, …) with **no gaps**.
  - `fr` is required (used for numbering & layout).
  - `en` and `es` can be omitted for a given line if you do not have that translation yet (leave the key out or set it to `null`); the viewer will simply render that cell empty.

### 3. Stanzas / blocks

- **Array**: `blocks` inside each poem.
- **Purpose**: tells the viewer where stanzas start and where blank separators go.
- **Pattern**:

```javascript
blocks: (function () {
  var b = [];
  for (var s = 0; s < STANZA_COUNT; s++) {
    b.push({ type: 'stanza' });
    if (s < STANZA_COUNT - 1) b.push({ type: 'blank' });
  }
  return b;
})(),
```

- **Important details**:
  - Each stanza block should carry its own `lines` count: `{ type: 'stanza', lines: 4 }`.
    This lets one poem mix stanza lengths — a sonnet is `4, 4, 3, 3`.
  - A block may also be `{ type: 'part', label: 'II' }` for poems written in
    numbered parts; it renders as a centered numeral row.
  - If a stanza block has no `lines`, the viewer falls back to the
    `data-lines-per-stanza="4"` hint on `.comparison` in `index.html` and
    **assumes every stanza has the same number of lines**.
  - Internally, it slices `segments` in fixed chunks of `LINES_PER_STANZA` to fill each `{ type: 'stanza' }` block.

So, for a 4‑line stanza poem:

- 1 stanza → 4 segments, `STANZA_COUNT = 1`, `blocks.length = 1`.
- 5 stanzas → 20 segments, `STANZA_COUNT = 5`, `blocks.length = 9` (5 stanzas + 4 blanks).

If your poem uses a different line count per stanza, you must:

1. Change `data-lines-per-stanza` in `index.html`, **or**
2. Customize `LINES_PER_STANZA` in `translation.js` (and keep the poem consistent with that).

### 4. Poem order and sections

There is no explicit “section” field on each poem. Instead:

- **Order** is defined at the bottom of `translation-data.js`:

```javascript
(function () {
  var order = ['benediction', 'l-albatros', 'elevation', 'une-charogne', 'le-vin'];
  var ids = order.filter(function (id) { return window.POEMS[id]; });
  if (ids.length === 0) ids = Object.keys(window.POEMS);
  var defaultId = ids[0];
  var poem = window.POEMS[defaultId];
  window.TRANSLATION_SEGMENTS = poem.segments;
  window.TRANSLATION_BLOCKS = poem.blocks;
  window.POEM_IDS = ids;
  window.CURRENT_POEM_ID = defaultId;
})();
```

- **Navigation**:
  - Prev/next buttons walk `window.POEM_IDS` in order.
  - The sidebar currently uses **only the first `ul.poem-list`** in `index.html` (`data-section="spleen-et-ideal"`) and fills it with all poems in `window.POEM_IDS`.
  - Other sections in the sidebar (`Tableaux Parisiens`, `Le Vin`, etc.) exist in the HTML/CSS but are not wired up yet.

To treat poems as “Spleen et Idéal”, “Le Vin”, etc., you simply:

- **Control the order** in the `order` array.
- Optionally, when you later wire sections per `data-section`, you can split `window.POEM_IDS` by convention (e.g. by prefix in the id or by a new `section` field).

### 5. How to add a new poem (minimal checklist)

1. **Pick an id** (e.g. `une-autre-poesie`), and add a new entry in `window.POEMS` in `translation-data.js`:
   - Set `title` (French).
   - Set `titles.fr`, `titles.en`, `titles.es`.
2. **Add all lines** to `segments`:
   - Ensure `id` runs from 0 to `N - 1` with no gaps.
   - Fill `fr` and any translations you have.
3. **Define `blocks`**:
   - Decide `STANZA_COUNT` for this poem.
   - Use the same pattern as existing poems, matching the stanza count and the global `LINES_PER_STANZA` (default 4).
4. **Update `order`**:
   - Add your new poem id into the `order` array where you want it to appear in navigation.
5. **Open the site** (`index.html` in a browser) and:
   - Use the sidebar or hash (`#your-id`) to load the poem.
   - Quickly scan stanza breaks and line counts.

Once you follow this pattern, adding poems is copy‑paste work with just the text lines changed.

### 6. Search

`search.js` searches everything in `window.POEMS` with no backend and no build
step — open it with **Ctrl/Cmd + K**, **`/`**, or the sidebar Search button.

- **What is indexed**: every `titles.*` value and every `segments[].fr/en/es`
  string. Nothing else needs declaring — a poem becomes searchable as soon as it
  is registered in `window.POEMS` and listed in `order`.
- **One query, all languages**: French, English and Spanish are searched
  together, and each result is badged with the language(s) it matched in.
- **Accents and spelling are forgiving**: text is folded before matching, so
  `ame` finds `âme`, `corazon` finds `corazón`, `coeur` finds `cœur`, and
  `l'homme` finds `l’homme` with a straight apostrophe.
- **Multiple words**: a poem matches when *every* term appears somewhere in it
  (title or any line, any language). Lines carrying the terms are listed in
  reading order, best matches first, capped at four with a "more lines" row.
- **Opening a result** switches poem, switches the translation column when the
  hit was in a translation, then scrolls to the line and flashes it in both
  columns.

Keys: `↑`/`↓` move, `↵` opens, `Esc` closes.

