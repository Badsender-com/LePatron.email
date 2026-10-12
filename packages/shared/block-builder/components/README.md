# Block builder components

The markup of the block builder's five elements (text, image, button, divider,
spacer) is written here as Vue single-file components with Tailwind classes —
the dialect of Maizzle 6 — and compiled **once, at build time**, into the
templates the generator renders on every keystroke in the editor.

Vue never reaches the browser. What ships is the committed `*.compiled.js`: email
HTML with typed `[[name|CONTEXT|fallback]]` holes, which the template engine
(`../template.js`) fills and escapes at render time.

```
button.vue + button.slots.js ──yarn block-builder:compile──► button.compiled.js
                                                              (committed)
```

## The files

| File                 | Who edits it | What it holds                                                                                   |
| -------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| `<name>.vue`         | you          | the markup: `<template>`, and a `<script setup>` holding only `defineProps`                     |
| `<name>.slots.js`    | you          | the manifest: each prop's escaping context and default, and the variants if the markup branches |
| `<name>.compiled.js` | the compiler | the output — never edit it by hand                                                              |

The element modules (`../elements/<name>.js`) read the compiled file and take
their defaults from the manifest; they normally need no change.

### The manifest

```js
module.exports = {
  slots: {
    label: { context: 'TEXT', default: '' },
    href: { context: 'URL', default: '', fallback: '#' },
    fontSize: { context: 'PX', default: 16 },
  },
  // Only when the markup has a v-if: one compiled template per entry, rendered
  // with these props fixed. See image.slots.js.
  variants: { plain: { linked: false }, linked: { linked: true } },
};
```

- `context` is what makes a value safe where it lands: `TEXT`, `RICH_TEXT`,
  `ATTR`, `URL`, `COLOR`, `PX`, `CSS_VALUE` (see `../slot-contexts.js`).
- `default` is the value a new element starts with — an integer for `PX`, a
  string otherwise — and what the generator falls back to when a value is
  refused (a size that is not one).
- `fallback` overrides that second use, when the default would be wrong in the
  markup (an empty `href` links to the page itself).
- `translatable: true` marks an `ATTR` slot whose value is prose (an image
  `alt`), so the AI translation rewrites it. `TEXT` and `RICH_TEXT` slots are
  always translated; `URL`, `COLOR`, `PX` and `CSS_VALUE` never are, and the
  compiler refuses the flag on them.

## The workflow

1. Edit the `.vue` and/or the `.slots.js`.
2. Run `yarn block-builder:compile`.
3. Commit the `.vue`, the `.slots.js` **and** the regenerated `.compiled.js`
   together.

The pre-commit hook does step 2 for you on the components you stage, and stages
their compiled files. A golden test (`yarn test-ci`, and
`yarn block-builder:compile --check`) recompiles every component and fails on
any difference with what is committed — so a hand edit of a compiled file, or a
source change committed without its output, cannot reach `develop`.

## What the compiler accepts

The compiler renders the `<template>` against placeholder values and reads
`defineProps`. Nothing else in the file runs, so anything else would be silently
ignored — and is refused instead, with the reason.

**Vue**

- One root element. A `v-if` / `v-else` chain counts as one.
- `<script setup>` with exactly one statement, `defineProps({ … })` (optionally
  bound: `const props = defineProps(…)`). No `computed`, no import, no
  `withDefaults`: defaults belong to the manifest.
- Props rendered as they are: `{{ label }}`, `:href="href"`,
  `` :style="`color:${color};`" ``, `v-html="content"` for `RICH_TEXT`. No
  method call or transformation on a prop (`label.toUpperCase()`): the value is
  only known at render time.
- `v-if` only on a prop a variant fixes, never on something the user types.
- Comments are notes for the next author and are stripped — except Outlook's
  conditional comments (`<!--[if mso]>…<![endif]-->`,
  `<!--[if !mso]><!-->…<!--<![endif]-->`), which ship as written.

Refused: a `<style>` block, a plain `<script>`, custom blocks, several roots, a
`v-for` or any other fragment, a template compile error, a Vue warning at
render time, and `undefined`, `null` or `NaN` in the output.

**Props and manifest**

- `defineProps` and the manifest name the same props, both ways; the template
  reads nothing else.
- Every slot is rendered by at least one variant.
- Each slot's context must fit where it lands: `TEXT`/`RICH_TEXT` in text
  content; `URL` as the whole value of `href`, `src` (and other fetched
  attributes); `COLOR`/`PX`/`CSS_VALUE` in `style` or other attribute values;
  `ATTR` in attribute values other than `style`. A prop landing in two places
  no single context covers must be split into two slots.
- A fallback may not contain `[`, `]` or `|` (they would break the
  placeholder), and must be a value its own context accepts unchanged.
- `translatable`, when given, is a boolean on an `ATTR` slot.

**Tailwind**

The classes are resolved with an email-safe config
(`scripts/block-builder/tailwind.config.js`: the default theme in `px`, colours
as hex, `underline`/`no-underline` as the `text-decoration` shorthand), inlined
into `style`, and the class attributes dropped. The build fails on:

- a class that inlines to nothing — unknown, disabled, or a utility that needs
  a selector inline styles cannot express (`space-y-*`, `divide-*`);
- a responsive or state variant (`sm:`, `hover:`) — they need a stylesheet in
  the document head, which is not wired to the generator yet;
- `var(`, a `--tw-*` property, a `rem` unit, `text-decoration-line` or a
  space-separated `rgb()`, from a class or a hand-written `style` — email
  clients drop all of them.

Arbitrary properties work (`[mso-hide:all]`), as do arbitrary values in `px`
(`p-[10px]`).
