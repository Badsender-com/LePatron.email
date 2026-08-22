'use strict';

// The panel's preheader field binds to the SAME observable as the "Preheader"
// field of Template Options. That is the whole mechanism: the editor holds the
// template data in memory and rewrites it wholesale on the global save, so a
// PATCH of the preheader would be overwritten at the next save — and two copies
// would drift. Sharing the observable means there is nothing to synchronise.
//
// Exercised with real Knockout observables, not stubs: `isObservable` is the
// discriminator the helper relies on, and a fake would not tell us whether it
// actually works.

const ko = require('knockout');

const {
  findPreheaderObservable,
  readPreheader,
} = require('../../packages/editor/src/js/utils/preheader-observable.js');

// Shape of a template declaring `template preheaderText { label: Preheader; }`
const rootTemplate = () =>
  ko.observable({
    preheaderText: ko.observable('racine'),
    titleBlock: ko.observable({ text: ko.observable('titre') }),
  });

// Shape of a template whose preheader lives in a block (Clarins family)
const blockTemplate = () =>
  ko.observable({
    preheaderBlock: ko.observable({
      preheaderText: ko.observable('bloc'),
      backgroundColor: ko.observable('#fff'),
    }),
    titleBlock: ko.observable({ text: ko.observable('titre') }),
  });

describe('findPreheaderObservable — location', () => {
  it('finds a template-level property', () => {
    const found = findPreheaderObservable(rootTemplate());

    expect(found.location).toBe('root');
    expect(found.blockName).toBeNull();
    expect(found.observable()).toBe('racine');
  });

  it('finds a property held by a block', () => {
    const found = findPreheaderObservable(blockTemplate());

    expect(found.location).toBe('block');
    expect(found.blockName).toBe('preheaderBlock');
    expect(found.observable()).toBe('bloc');
  });

  it('prefers the template property when a template declares both', () => {
    const content = ko.observable({
      preheaderText: ko.observable('racine'),
      preheaderBlock: ko.observable({ preheaderText: ko.observable('bloc') }),
    });

    expect(findPreheaderObservable(content).location).toBe('root');
  });

  // A template is free to name its block something else; scanning by property
  // rather than by block name is what makes that work.
  it('finds the property in a block whatever the block is called', () => {
    const content = ko.observable({
      entete: ko.observable({ preheaderText: ko.observable('autre nom') }),
    });

    const found = findPreheaderObservable(content);
    expect(found.blockName).toBe('entete');
    expect(found.observable()).toBe('autre nom');
  });

  it('returns null on a template that declares no preheader', () => {
    const content = ko.observable({
      titleBlock: ko.observable({ text: ko.observable('titre') }),
    });

    expect(findPreheaderObservable(content)).toBeNull();
  });

  it.each([[null], [undefined], ['une chaîne'], [42], [ko.observable(null)]])(
    'returns null on malformed content (%p)',
    (content) => {
      expect(findPreheaderObservable(content)).toBeNull();
    }
  );

  // A plain string where an observable is expected is not the live value the
  // panel needs: writing to it would change nothing.
  it('ignores a non-observable property of the same name', () => {
    const content = ko.observable({ preheaderText: 'valeur figée' });

    expect(findPreheaderObservable(content)).toBeNull();
  });

  it('accepts plain content as well as an observable', () => {
    const content = { preheaderText: ko.observable('racine') };

    expect(findPreheaderObservable(content).location).toBe('root');
  });
});

describe('findPreheaderObservable — it really is the live observable', () => {
  it.each([
    ['root', rootTemplate],
    ['block', blockTemplate],
  ])('writing through the panel updates the template (%s)', (_label, make) => {
    const content = make();
    const found = findPreheaderObservable(content);

    found.observable('écrit par le panneau');

    // Read back through the template, the way Template Options would.
    expect(readPreheader(content)).toBe('écrit par le panneau');
  });

  it.each([
    ['root', rootTemplate],
    ['block', blockTemplate],
  ])('a change made elsewhere reaches the panel (%s)', (_label, make) => {
    const content = make();
    const found = findPreheaderObservable(content);
    const seen = [];
    found.observable.subscribe((v) => seen.push(v));

    // Template Options writing to the same observable.
    const root = content();
    const target = found.location === 'root' ? root : root[found.blockName]();
    target.preheaderText('écrit par Template Options');

    expect(seen).toEqual(['écrit par Template Options']);
    expect(found.observable()).toBe('écrit par Template Options');
  });
});

describe('readPreheader', () => {
  it.each([
    ['root', rootTemplate, 'racine'],
    ['block', blockTemplate, 'bloc'],
  ])('reads the %s location', (_label, make, expected) => {
    expect(readPreheader(make())).toBe(expected);
  });

  it('returns null when the template has none, so the field can be disabled', () => {
    expect(
      readPreheader(ko.observable({ titleBlock: ko.observable({}) }))
    ).toBeNull();
  });

  it('returns an empty string, not null, on a declared but empty property', () => {
    expect(
      readPreheader(ko.observable({ preheaderText: ko.observable('') }))
    ).toBe('');
  });

  it('coerces a non-string value to an empty string', () => {
    expect(
      readPreheader(ko.observable({ preheaderText: ko.observable(null) }))
    ).toBe('');
  });
});
