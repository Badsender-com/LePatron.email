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
const { parse, compileScript } = require('@vue/compiler-sfc');
const { createSSRApp } = require('vue3');
const { renderToString } = require('vue3/server-renderer');

const {
  compileTemplate,
} = require('../packages/shared/block-builder/template.js');
const {
  sentinelFor,
  inlineStyles,
  substitutePlaceholders,
} = require('./block-builder/markup-pipeline.js');

const COMPONENTS_DIR = path.join(
  __dirname,
  '..',
  'packages',
  'shared',
  'block-builder',
  'components'
);

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
