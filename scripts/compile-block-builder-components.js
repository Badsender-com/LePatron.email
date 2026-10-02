#!/usr/bin/env node
'use strict';

// Compiles the block builder's Vue components into the templates the generator
// renders at runtime.
//
//   yarn block-builder:compile [--check] [--stage] [file…]
//
//   --check   compare instead of write, and fail on any difference (CI)
//   --stage   `git add` what was written (the pre-commit hook)
//   file…     only the components these .vue/.slots.js files belong to
//
// The integrator's side of this — what to edit, what to commit, what the
// compiler refuses — is packages/shared/block-builder/components/README.md.
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

// Vue picks its build from NODE_ENV when it is first required, and only the
// development build reports the warnings the compiler refuses a component on.
// Forced here so a production shell compiles the same files as a laptop.
process.env.NODE_ENV = 'development';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  COMPONENTS_DIR,
  compileComponent,
  listComponents,
} = require('./block-builder/compile-component.js');

/**
 * The components to compile: those the given files belong to, or all.
 *
 * @param {Array<string>} files paths to .vue or .slots.js files
 * @returns {Array<string>}
 */
function selectComponents(files) {
  const all = listComponents();
  if (files.length === 0) return all;
  const named = new Set(
    files.map((file) => path.basename(file).replace(/\.(vue|slots\.js)$/, ''))
  );
  return all.filter((name) => named.has(name));
}

/**
 * @returns {Promise<boolean>} whether the committed file was already current
 */
async function compileOne(name, { check }) {
  const destination = path.join(COMPONENTS_DIR, `${name}.compiled.js`);
  const next = await compileComponent(name);
  const current = fs.existsSync(destination)
    ? fs.readFileSync(destination, 'utf8')
    : '';

  if (check) {
    process.stdout.write(
      current === next
        ? `✓ ${name}\n`
        : `✗ ${name} — the compiled file has drifted\n`
    );
  } else {
    fs.writeFileSync(destination, next, 'utf8');
    process.stdout.write(`✓ ${name} → ${path.relative('.', destination)}\n`);
  }
  return current === next;
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const stage = args.includes('--stage');
  const names = selectComponents(args.filter((arg) => !arg.startsWith('--')));
  let drifted = 0;

  for (const name of names) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await compileOne(name, { check }))) drifted += 1;
  }

  if (stage && !check && names.length) {
    const compiled = names.map((name) =>
      path.join(COMPONENTS_DIR, `${name}.compiled.js`)
    );
    execFileSync('git', ['add', '--', ...compiled], { stdio: 'inherit' });
  }

  if (check && drifted > 0) {
    process.stdout.write(
      `\n${drifted} component(s) drifted. Run \`yarn block-builder:compile\`.\n`
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
