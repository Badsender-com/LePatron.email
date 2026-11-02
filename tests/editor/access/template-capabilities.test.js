'use strict';

// The templates ask for a capability by its name, a string Knockout reads at
// render time: a misspelt one would throw on the first render, or lock a
// panel for everyone. Every name used is pinned against the shared list, and
// no template reads a right off the user directly any more.

const fs = require('fs');
const path = require('path');

const {
  ALL_CAPABILITIES,
} = require('../../../packages/shared/access/roles.js');

const EDITOR = path.join(__dirname, '../../../packages/editor/src');

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return /\.(html|js)$/.test(entry.name) ? [full] : [];
  });
}

const SOURCES = filesUnder(EDITOR).map((file) => ({
  file: path.relative(EDITOR, file),
  text: fs.readFileSync(file, 'utf8'),
}));

describe('the capabilities the editor asks for', () => {
  const asked = SOURCES.flatMap(({ file, text }) =>
    [...text.matchAll(/userCan\(\s*'([^']+)'\s*\)/g)].map((match) => ({
      file,
      capability: match[1],
    }))
  );

  it('are found in the templates', () => {
    expect(asked.length).toBeGreaterThan(5);
  });

  it('all exist', () => {
    const unknown = asked.filter(
      ({ capability }) => !ALL_CAPABILITIES.includes(capability)
    );

    expect(unknown).toEqual([]);
  });

  it('are never read off the user as flags', () => {
    const flags = SOURCES.filter(({ text }) =>
      /currentUser\(\)\??\.(can[A-Z]|isReadOnly)/.test(text)
    ).map(({ file }) => file);

    expect(flags).toEqual([]);
  });
});
