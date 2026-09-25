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

const {
  renderGallery,
} = require('../packages/shared/block-builder/gallery.js');

const destination = path.resolve(
  process.argv[2] || 'block-builder-gallery.html'
);

const html = renderGallery();
fs.writeFileSync(destination, html, 'utf8');

const kb = Math.round((Buffer.byteLength(html, 'utf8') / 1024) * 10) / 10;
process.stdout.write(`Galerie écrite : ${destination} (${kb} Ko)\n`);
