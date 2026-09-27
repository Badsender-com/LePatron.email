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
const { parse } = require('@vue/compiler-sfc');
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
  const slots = require(manifestPath);

  Object.entries(slots).forEach(([slotName, slot]) => {
    if (!slot || !slot.context) {
      throw new Error(
        `${name}.slots.js: slot "${slotName}" declares no context.`
      );
    }
  });

  return { template: descriptor.template.content, slots, sfcPath };
}

/**
 * Renders the component once, with a sentinel in place of every prop.
 *
 * @returns {Promise<string>} HTML still carrying the sentinels
 */
async function renderWithSentinels({ template, slots }) {
  const names = Object.keys(slots);
  const props = names.reduce((all, name) => {
    all[name] = sentinelFor(name);
    return all;
  }, {});

  const app = createSSRApp({ props: names, template }, props);
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

  return inlined.replace(/\s+class="[^"]*"/g, '');
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

  Object.entries(slots).forEach(([slotName, slot]) => {
    const sentinel = sentinelFor(slotName);
    if (!out.includes(sentinel)) {
      throw new Error(
        `${name}.vue: slot "${slotName}" is declared but never rendered. ` +
          `Either use it in the template or drop it from ${name}.slots.js.`
      );
    }
    out = out.split(sentinel).join(placeholderFor(slotName, slot));
  });

  const stray = new RegExp(`${SENTINEL_PREFIX}[A-Za-z0-9]*`).exec(out);
  if (stray) {
    throw new Error(
      `${name}.vue: a sentinel survived compilation (${stray[0]}). ` +
        'A prop is rendered that no slot declares.'
    );
  }

  return out;
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
  const rendered = await renderWithSentinels(component);
  const inlined = await inlineStyles(rendered);
  const template = substitutePlaceholders(inlined, component.slots, name);

  // Compiled by the real engine before being written. It is the engine that
  // knows which contexts exist, and it throws on one it does not — so an
  // unknown context fails the build here rather than shipping a template the
  // editor cannot render. The invariant is checked too, since everything
  // downstream relies on it.
  const compiled = compileTemplate(template);
  if (compiled.chunks.length !== compiled.slots.length + 1) {
    throw new Error(`${name}: compiled template is inconsistent.`);
  }

  return `${banner(name)}module.exports = ${JSON.stringify(template)};\n`;
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
