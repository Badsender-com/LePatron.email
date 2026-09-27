#!/usr/bin/env node
'use strict';

// Compiles the block builder's Vue components into the templates the generator
// renders at runtime.
//
//   yarn block-builder:compile [--check]
//
// Why a build step at all: the team writes Maizzle every day, and a Vue SFC is
// the dialect Maizzle 6 uses — so the people who own the email HTML can own
// these components too, in a format they recognise, with Tailwind classes
// rather than hand-written inline styles. None of that can reach the browser:
// the editor renders a block on every keystroke, from a CommonJS bundle, with
// no dependencies. So Vue runs HERE, once, and what ships is a string.
//
//   button.vue  ──render with sentinels──►  HTML  ──Tailwind + inline──►  HTML
//               ──replace sentinels──►  '<td …>[[label|TEXT]]…'  ──►  committed
//
// The compiled artifact is deliberately the PLACEHOLDER SOURCE, not a
// pre-split { chunks, slots }. Three reasons: an integrator can read the
// committed file and see real email HTML; `compileTemplate` still parses it, so
// it still refuses a slot whose context it does not know; and every existing
// test of the engine keeps testing the thing that actually runs.
//
// Maizzle itself is not used. Its version 6 needs Node ^20.19 (through Vite 8)
// and this project is pinned to 18.18.0, in package.json and in both CI
// workflows. Rendering the SFC directly costs five dependencies instead of a
// Vite toolchain, runs on the project's Node, and keeps the authoring format
// identical — which was the point.

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const juice = require('juice');
const { parse, compileScript } = require('@vue/compiler-sfc');
const { createSSRApp } = require('vue3');
const { renderToString } = require('vue3/server-renderer');

const {
  compileTemplate,
} = require('../packages/shared/block-builder/template.js');

const COMPONENTS_DIR = path.join(
  __dirname,
  '..',
  'packages',
  'shared',
  'block-builder',
  'components'
);

// Sentinels stand in for every prop while the component renders.
//
// Letters and digits only, and nothing that looks like markup: Vue escapes
// interpolations, Tailwind rewrites class attributes and juice rewrites style
// attributes, and a sentinel has to come out the other end byte for byte. The
// same reasoning, and the same shape, as the export substitution markers in
// packages/editor/src/js/ext/html-code-block/export-substitution.js.
const SENTINEL_PREFIX = 'LPSLOT';

const sentinelFor = (name) =>
  `${SENTINEL_PREFIX}${name.replace(/[^a-zA-Z0-9]/g, '')}X${name.length}`;

/**
 * The `[[name|CONTEXT|fallback]]` placeholder a slot compiles to.
 *
 * @param {string} name
 * @param {Object} slot its manifest entry
 * @returns {string}
 */
function placeholderFor(name, slot) {
  const fallback = slot.fallback === undefined ? '' : String(slot.fallback);
  return `[[${name}|${slot.context}|${fallback}]]`;
}

/**
 * Reads a component and its manifest, and refuses anything ambiguous.
 *
 * Every prop must be declared, and every declared prop must carry a context the
 * engine knows. A prop nobody declared would otherwise render a sentinel into
 * the shipped HTML, or — worse — reach the output with no escaping at all.
 */
function loadComponent(name) {
  const sfcPath = path.join(COMPONENTS_DIR, `${name}.vue`);
  const manifestPath = path.join(COMPONENTS_DIR, `${name}.slots.js`);

  const source = fs.readFileSync(sfcPath, 'utf8');
  const { descriptor, errors } = parse(source, { filename: `${name}.vue` });
  if (errors.length) {
    throw new Error(
      `${name}.vue does not parse:\n${errors
        .map((e) => `  ${e.message}`)
        .join('\n')}`
    );
  }
  if (!descriptor.template) {
    throw new Error(`${name}.vue has no <template>.`);
  }

  // eslint-disable-next-line import/no-dynamic-require, global-require
  const manifest = require(manifestPath);
  const slots = manifest.slots || {};

  if (Object.keys(slots).length === 0) {
    throw new Error(`${name}.slots.js exports no slots.`);
  }

  Object.entries(slots).forEach(([slotName, slot]) => {
    if (!slot || !slot.context) {
      throw new Error(
        `${name}.slots.js: slot "${slotName}" declares no context.`
      );
    }
  });

  // A component with no variants compiles to one template. With variants it
  // compiles to one per entry, each rendered with those props FIXED — which is
  // how a `v-if` is allowed to exist at all: the generator joins strings, it
  // never branches, so every branch has to be resolved here.
  //
  // `{ default: {} }` keeps the two cases on the same path.
  const variants = manifest.variants || { default: {} };

  assertPropsDeclared(name, descriptor, slots, variants);

  return { template: descriptor.template.content, slots, variants, sfcPath };
}

/**
 * Every prop the component declares must be a slot or a variant prop.
 *
 * Without this, a prop the manifest forgot renders as `undefined`: Vue drops
 * the attribute, no sentinel is created, nothing survives to be caught, and the
 * component compiles to markup with a hole silently missing. A colour that
 * never reaches the style, a width that never reaches the tag — and the only
 * symptom is an email that looks wrong in production.
 *
 * `defineProps` is the right place to read it from: it is what the author
 * already writes, so the two lists cannot drift without one of them being edited.
 */
function assertPropsDeclared(name, descriptor, slots, variants) {
  if (!descriptor.scriptSetup) return;

  const { bindings } = compileScript(descriptor, { id: name });
  const declared = Object.entries(bindings || {})
    .filter(([, kind]) => kind === 'props')
    .map(([prop]) => prop);

  const known = new Set(Object.keys(slots));
  Object.values(variants).forEach((fixed) =>
    Object.keys(fixed).forEach((prop) => known.add(prop))
  );

  const undeclared = declared.filter((prop) => !known.has(prop));
  if (undeclared.length) {
    throw new Error(
      `${name}.vue declares ${undeclared.map((p) => `"${p}"`).join(', ')}, ` +
        `which ${name}.slots.js neither lists as a slot nor fixes in a ` +
        'variant. A prop with no context would render as nothing at all.'
    );
  }
}

/**
 * Renders the component once, with a sentinel in place of every prop.
 *
 * @returns {Promise<string>} HTML still carrying the sentinels
 */
async function renderWithSentinels({ template, slots }, fixed) {
  const slotNames = Object.keys(slots);
  const fixedNames = Object.keys(fixed);

  const props = slotNames.reduce((all, name) => {
    all[name] = sentinelFor(name);
    return all;
  }, {});

  // The variant's own props are real values, not sentinels: they are what the
  // `v-if` reads, and they must not survive into the output.
  Object.assign(props, fixed);

  const app = createSSRApp(
    { props: slotNames.concat(fixedNames), template },
    props
  );
  return renderToString(app);
}

/**
 * Resolves the Tailwind classes the markup uses and inlines them.
 *
 * Inlined rather than left as classes because the block travels into other
 * people's templates: it can rely on no stylesheet but its own. Responsive
 * classes cannot survive this — they need a media query in the document head —
 * which is why the components are forbidden from using them for now.
 */
async function inlineStyles(html) {
  const { css } = await postcss([
    tailwind({
      content: [{ raw: html, extension: 'html' }],
      corePlugins: { preflight: false },
    }),
  ]).process('@tailwind utilities;', { from: undefined });

  const inlined = juice.inlineContent(html, css, { removeStyleTags: true });

  // juice folds the rules into `style` but leaves the class names behind, and
  // a class nothing defines is dead weight in every email that ships. They are
  // stripped here — which is only safe because responsive classes are
  // forbidden, so nothing needs a class to survive.
  const responsive = /class="[^"]*\b[a-z]+:[a-z-]/.exec(inlined);
  if (responsive) {
    throw new Error(
      'a responsive class survived inlining: ' +
        `${responsive[0]}…\nThose need a media query in the document head, and ` +
        'that channel is not wired to the generator yet.'
    );
  }

  return closeVoidTags(
    reEncodeEntities(inlined.replace(/\s+class="[^"]*"/g, ''))
  );
}

/**
 * Puts back the entities Vue decoded on its way through.
 *
 * `&nbsp;` in a template becomes a raw U+00A0 in the render, and the raw
 * character is not the same thing downstream: the export pipeline encodes
 * non-ASCII to numeric entities, so what a recipient receives would depend on
 * which path produced it. The spacer and the divider both rely on that
 * character keeping a cell from collapsing, so it is written back explicitly
 * rather than left to whatever runs next.
 */
function reEncodeEntities(html) {
  return html.replace(/\u00a0/g, '&nbsp;');
}

// Void elements, as HTML5 spells them.
const VOID_TAG = /<(img|br|hr|input|meta|link|area|base|col|source|track|wbr)\b([^>]*?)\s*\/?>/gi;

/**
 * Closes void tags the XHTML way.
 *
 * Vue's SSR emits `<img …>`, which is right for HTML5 and wrong for the
 * document these fragments land in: the export declares an XHTML transitional
 * doctype, as email templates generally do. Every client parses either, so this
 * is not a rendering fix — it keeps the generated markup consistent with the
 * document that carries it, and with what the hand-written templates emitted
 * before they were converted.
 */
function closeVoidTags(html) {
  return html.replace(VOID_TAG, (match, tag, attrs) => `<${tag}${attrs} />`);
}

/**
 * Swaps every sentinel back for the placeholder the generator understands.
 *
 * A sentinel that did not come back means the render swallowed it — a `v-if`
 * that hid the element, a prop that was never used — and that is a bug in the
 * component, not something to paper over.
 */
function substitutePlaceholders(html, slots, name) {
  let out = html;
  const used = [];

  Object.entries(slots).forEach(([slotName, slot]) => {
    const sentinel = sentinelFor(slotName);
    if (!out.includes(sentinel)) return;
    used.push(slotName);
    out = out.split(sentinel).join(placeholderFor(slotName, slot));
  });

  const stray = new RegExp(`${SENTINEL_PREFIX}[A-Za-z0-9]*`).exec(out);
  if (stray) {
    throw new Error(
      `${name}.vue: a sentinel survived compilation (${stray[0]}). ` +
        'A prop is rendered that no slot declares.'
    );
  }

  // A slot missing from THIS variant is normal — an image with no link does
  // not render an `href`. A slot missing from EVERY variant is a dead entry in
  // the manifest, and that is checked once all of them are compiled.
  return { html: out, used };
}

const banner = (name) =>
  [
    '// Generated by scripts/compile-block-builder-components.js — do not edit.',
    `// Source: packages/shared/block-builder/components/${name}.vue`,
    '//',
    '// Editing this file by hand is caught by the golden test: it recompiles',
    '// the component and fails on any difference.',
    "'use strict';",
    '',
  ].join('\n');

async function compile(name) {
  const component = loadComponent(name);
  const variantNames = Object.keys(component.variants);
  const templates = {};
  const everUsed = new Set();

  for (const variant of variantNames) {
    // eslint-disable-next-line no-await-in-loop
    const rendered = await renderWithSentinels(
      component,
      component.variants[variant]
    );
    // eslint-disable-next-line no-await-in-loop
    const inlined = await inlineStyles(rendered);
    const { html, used } = substitutePlaceholders(
      inlined,
      component.slots,
      `${name} (${variant})`
    );

    used.forEach((slot) => everUsed.add(slot));

    // Compiled by the real engine before being written. It is the engine that
    // knows which contexts exist, and it throws on one it does not — so an
    // unknown context fails the build here rather than shipping a template the
    // editor cannot render. The invariant is checked too, since everything
    // downstream relies on it.
    const compiled = compileTemplate(html);
    if (compiled.chunks.length !== compiled.slots.length + 1) {
      throw new Error(
        `${name} (${variant}): compiled template is inconsistent.`
      );
    }

    templates[variant] = html;
  }

  const dead = Object.keys(component.slots).filter(
    (slot) => !everUsed.has(slot)
  );
  if (dead.length) {
    throw new Error(
      `${name}.slots.js declares ${dead.map((d) => `"${d}"`).join(', ')}, ` +
        'which no variant renders. Use them or drop them.'
    );
  }

  const payload =
    variantNames.length === 1 && variantNames[0] === 'default'
      ? templates.default
      : templates;

  return `${banner(name)}module.exports = ${JSON.stringify(
    payload,
    null,
    2
  )};\n`;
}

async function main() {
  const check = process.argv.includes('--check');
  const names = fs
    .readdirSync(COMPONENTS_DIR)
    .filter((file) => file.endsWith('.vue'))
    .map((file) => path.basename(file, '.vue'))
    .sort();

  let drifted = 0;

  for (const name of names) {
    const destination = path.join(COMPONENTS_DIR, `${name}.compiled.js`);
    // eslint-disable-next-line no-await-in-loop
    const next = await compile(name);

    if (check) {
      const current = fs.existsSync(destination)
        ? fs.readFileSync(destination, 'utf8')
        : '';
      if (current !== next) {
        drifted += 1;
        process.stdout.write(`✗ ${name} — le fichier compilé a divergé\n`);
      } else {
        process.stdout.write(`✓ ${name}\n`);
      }
    } else {
      fs.writeFileSync(destination, next, 'utf8');
      process.stdout.write(`✓ ${name} → ${path.relative('.', destination)}\n`);
    }
  }

  if (check && drifted > 0) {
    process.stdout.write(
      `\n${drifted} composant(s) divergent. Lancez « yarn block-builder:compile ».\n`
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
