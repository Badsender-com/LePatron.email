#!/usr/bin/env node
'use strict';

// Writes the block builder's control gallery to a file, so it can be opened in
// a browser and sent through Litmus or Email on Acid.
//
//   yarn block-builder:gallery [destination]
//
// Nothing here touches the database or the editor: the point is to validate the
// generated markup in real clients before any of that exists.

const fs = require('fs');
const path = require('path');

const { renderGallery } = require('./block-builder-gallery.js');

const REPO = path.resolve(__dirname, '..');

/**
 * Where to write, refusing anywhere outside the repository.
 *
 * `process.argv[2]` is a path from whoever ran the command — a developer, a
 * script, or an agent driving the CLI — and `path.resolve` happily walks out of
 * the tree on `../../`. Nothing here is privileged, but a build script that
 * writes wherever it is told is a primitive worth not leaving lying around, and
 * the quality gate is right to say so.
 *
 * `path.relative` rather than a `startsWith` on the resolved path: the latter
 * accepts a sibling directory whose name merely begins with the repository's.
 */
function destinationFor(argument) {
  const target = path.resolve(REPO, argument || 'block-builder-gallery.html');
  const inside = path.relative(REPO, target);

  if (inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) {
    throw new Error(
      `Refus d'écrire hors du dépôt : ${target}\n` +
        'Donnez un chemin relatif à la racine du projet.'
    );
  }

  return target;
}

function main() {
  const destination = destinationFor(process.argv[2]);

  const html = renderGallery();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, html, 'utf8');

  const kb = Math.round((Buffer.byteLength(html, 'utf8') / 1024) * 10) / 10;
  process.stdout.write(`Galerie écrite : ${destination} (${kb} Ko)\n`);
}

// Required by its test as well as run as a command, so the refusal can be
// exercised without spawning a process — and so a bad path prints a sentence
// rather than a stack trace.
if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { destinationFor };
