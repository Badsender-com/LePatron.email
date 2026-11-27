'use strict';

// A composed block holds to the width it is laid out for.
//
// Its rows are laid out in px of 600 (row-layout.js), and the modal previews
// it at 600, but its outer table was 100% wide: in a template whose block
// slot is wider than the content — 800px, each native block centring its own
// 600px table — the block spread over 800px, its halves became 400px, and it
// lined up with nothing around it. The outer table is now 600px, centred, and
// never wider than what holds it, so a phone still gets the whole block.

const {
  generate,
  emptyState,
  GENERATOR_VERSION,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  singleColumnRows,
} = require('../../../packages/shared/block-builder/composition.js');
const {
  BLOCK_WIDTH,
} = require('../../../packages/shared/block-builder/row-layout.js');

const OUTER = /^<table[^>]*>/;

const withText = () => ({
  ...emptyState(),
  rows: singleColumnRows([{ id: 't1', type: 'text', content: 'Bonjour' }]),
});

const halves = () => ({
  ...emptyState(),
  rows: [
    {
      id: 'r1',
      columns: [
        { width: 300, elements: [{ id: 't1', type: 'text', content: 'A' }] },
        { width: 300, elements: [{ id: 't2', type: 'text', content: 'B' }] },
      ],
    },
  ],
});

describe('a composed block', () => {
  it('is laid out for 600px', () => {
    expect(BLOCK_WIDTH).toBe(600);
  });

  it.each([
    ['a flat block', withText],
    ['a block of columns', halves],
  ])('is %s held to 600px, centred', (_name, make) => {
    const [outer] = generate(make()).match(OUTER);

    expect(outer).toContain(' width="600"');
    expect(outer).toContain(' align="center"');
    expect(outer).toContain('style="width:600px;max-width:100%;');
    expect(outer).not.toContain('width="100%"');
  });

  it('keeps its background on the outer table', () => {
    const state = withText();
    state.block.backgroundColor = '#ff0000';

    const [outer] = generate(state).match(OUTER);

    expect(outer).toContain('bgcolor="#ff0000"');
    expect(outer).toContain('background-color:#ff0000;');
  });

  // The preview shows the block as it will be sent.
  it('is held to the same width in the preview', () => {
    const [outer] = generate(halves(), {
      elementIds: true,
      chrome: true,
    }).match(OUTER);

    expect(outer).toContain('style="width:600px;max-width:100%;');
  });

  // Every block written before renders differently now: a reopened one says
  // so (see `rebuildsMarkup` in the modal), which takes a new version.
  it('is written by a generator past 1.0.0', () => {
    expect(GENERATOR_VERSION).not.toBe('1.0.0');
  });
});
