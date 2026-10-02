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

// Vue picks its build from NODE_ENV when it is first required, and only the
// development build reports the warnings the compiler refuses a component on.
// Forced here so a production shell compiles the same files as a laptop.
process.env.NODE_ENV = 'development';

const fs = require('fs');
const path = require('path');

const {
  COMPONENTS_DIR,
  compileComponent,
  listComponents,
} = require('./block-builder/compile-component.js');

async function main() {
  const check = process.argv.includes('--check');
  let drifted = 0;

  for (const name of listComponents()) {
    const destination = path.join(COMPONENTS_DIR, `${name}.compiled.js`);
    // eslint-disable-next-line no-await-in-loop
    const next = await compileComponent(name);

    if (check) {
      const current = fs.existsSync(destination)
        ? fs.readFileSync(destination, 'utf8')
        : '';
      if (current !== next) {
        drifted += 1;
        process.stdout.write(`✗ ${name} — the compiled file has drifted\n`);
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
      `\n${drifted} component(s) drifted. Run \`yarn block-builder:compile\`.\n`
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
