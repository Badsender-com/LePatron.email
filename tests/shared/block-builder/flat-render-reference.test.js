'use strict';

// A block stored before columns existed must render exactly as it did.
//
// Its HTML is frozen once written (see generate.js): an email a client already
// approved must not change because the generator learnt rows. Comparing the
// code to itself cannot prove that, so the expected markup here was produced by
// the generator of `develop` at 5fb092098 — the last one without columns — and
// committed as data. Nothing in this repository regenerates it, on purpose: a
// fixture rewritten by the code it checks would check nothing.
//
// Each case is a v1 state as stored, read back the way the server reads it
// (`parseState`), in both modes: the export, and the preview with its editing
// chrome (element ids, starters).

const {
  generate,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  parseState,
} = require('../../../packages/shared/block-builder/state.js');
const fixtures = require('./fixtures/flat-render-reference.json');

describe('a block stored before columns renders as it did', () => {
  it('covers every element, in both modes', () => {
    const types = new Set(
      fixtures.flatMap((fixture) =>
        JSON.parse(fixture.state).elements.map((element) => element.type)
      )
    );

    ['text', 'image', 'button', 'divider', 'spacer'].forEach((type) =>
      expect(types.has(type)).toBe(true)
    );
    expect(new Set(fixtures.map((fixture) => fixture.mode))).toEqual(
      new Set(['export', 'preview'])
    );
  });

  test.each(fixtures.map((fixture) => [fixture.name, fixture]))(
    '%s',
    (_name, fixture) => {
      expect(generate(parseState(fixture.state), fixture.options)).toBe(
        fixture.html
      );
    }
  );
});
