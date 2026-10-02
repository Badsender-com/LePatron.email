'use strict';

// Where the control gallery is allowed to be written.
//
// `process.argv[2]` is a path from whoever ran the command — a developer, a
// script, or an agent driving the CLI — and `path.resolve` happily walks out of
// the tree on `../../`. Nothing about this script is privileged, but a build
// step that writes wherever it is told is a primitive worth not leaving lying
// around, and SonarCloud's quality gate is right to refuse it.

const path = require('path');

const {
  destinationFor,
} = require('../../scripts/build-block-builder-gallery.js');

const REPO = path.resolve(__dirname, '..', '..');

describe('a destination inside the repository', () => {
  it('defaults to the repository root', () => {
    expect(destinationFor(undefined)).toBe(
      path.join(REPO, 'block-builder-gallery.html')
    );
  });

  it('accepts a relative path', () => {
    expect(destinationFor('build/galerie.html')).toBe(
      path.join(REPO, 'build', 'galerie.html')
    );
  });

  it('accepts a path that walks out and back in', () => {
    expect(destinationFor('scripts/../galerie.html')).toBe(
      path.join(REPO, 'galerie.html')
    );
  });
});

describe('a destination outside it is refused', () => {
  test.each([
    ['a parent directory', '../evade.html'],
    ['several levels up', '../../../tmp/evade.html'],
    ['an absolute path', '/tmp/evade.html'],
    ['the repository itself', '.'],
  ])('%s', (_label, argument) => {
    expect(() => destinationFor(argument)).toThrow(/hors du dépôt|dépôt/);
  });

  // `path.relative` rather than a `startsWith` on the resolved path: the latter
  // accepts a sibling directory whose name merely begins with the repository's.
  it('refuses a sibling whose name starts like the repository', () => {
    expect(() => destinationFor(`${REPO}-autre/evade.html`)).toThrow();
  });
});
