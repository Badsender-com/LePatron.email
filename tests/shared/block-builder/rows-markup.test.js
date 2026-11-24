'use strict';

// The markup of one row of columns (row-markup.js): its cells, what each cell
// carries, and what an element inside one is told about the room it has.
//
// Tested at `generateRow` rather than through `generate`, so these hold
// whatever `generate` decides to render as rows.

const {
  generateRow,
  BLOCK_WIDTH,
} = require('../../../packages/shared/block-builder/row-markup.js');
const {
  generate,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  elementFor,
} = require('../../../packages/shared/block-builder/elements/index.js');

const IMAGE = 'https://e.com/a.png';
const text = (id, content = 'Bonjour') => ({ id, type: 'text', content });
const image = (id, overrides) => ({
  id,
  type: 'image',
  src: IMAGE,
  ...overrides,
});
const row = (...columns) => ({
  id: 'r1',
  columns: columns.map(([width, elements]) => ({ width, elements })),
});

/** The opening tag of every cell of a row, in order. */
const cellsOf = (html) => html.match(/<td width="[^"]*"[^>]*>/g) || [];
/** Every `width` attribute an image carries, in order. */
const imageWidths = (html) =>
  (html.match(/<img [^>]*width="(\d+)"/g) || []).map((tag) =>
    Number(tag.match(/width="(\d+)"/)[1])
  );

describe('the row contract', () => {
  it('is one table of cells, written by the row component', () => {
    const html = generateRow(row([50, [text('a')]], [50, [text('b')]]));

    expect(html).toMatch(
      /^<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td /
    );
    expect(html).toMatch(/<\/td><\/tr><\/table>$/);
  });

  // Below a width, the columns of a row stack: that is the generated class.
  it('marks every cell of a row of several columns to stack', () => {
    const cells = cellsOf(generateRow(row([50, [text('a')]], [50, []])));

    expect(cells).toHaveLength(2);
    cells.forEach((cell) => expect(cell).toContain('class="lp-stack"'));
  });

  // Nothing to stack, and nothing to ship: not even an empty attribute.
  it('gives the cell of a row of one column no class attribute', () => {
    const [cell] = cellsOf(generateRow(row([100, [text('a')]])));

    expect(cell).not.toContain('class=');
  });

  it('aligns every cell to the top, filled or empty', () => {
    const cells = cellsOf(
      generateRow(row([33, [text('a')]], [33, []], [34, [text('c')]]))
    );

    expect(cells).toHaveLength(3);
    cells.forEach((cell) => expect(cell).toContain('valign="top"'));
  });
});

describe('an empty column', () => {
  // One rule for "nothing", shared with the flat block: an element is nothing
  // when its type is unknown, never because nothing was typed in it.
  it('is a column whose elements are all unknown', () => {
    const [, cell] = cellsOf(
      generateRow(row([50, [text('a')]], [50, [{ id: 'x', type: 'carousel' }]]))
    );

    expect(cell).toContain('font-size:0');
  });

  it('is not a column holding a text left blank', () => {
    const [, cell] = cellsOf(
      generateRow(row([50, [text('a')]], [50, [text('b', '')]]))
    );

    expect(cell).not.toContain('font-size:0');
  });
});

describe('what generateRow accepts', () => {
  // The modal hands `generate` the state it is editing, not what parseState
  // returns: the row is normalised the way parseState would store it.
  it('keeps the cell of a column that is not an object', () => {
    const html = generateRow({
      columns: [null, { width: 50, elements: [text('a')] }],
    });
    const cells = cellsOf(html);

    expect(cells).toHaveLength(2);
    cells.forEach((cell) => expect(cell).toContain('class="lp-stack"'));
  });

  test.each([
    ['missing', undefined],
    ['not a number', 'large'],
    ['NaN', Number.NaN],
  ])('shares the row equally when a width is %s', (_label, width) => {
    const html = generateRow({
      columns: [
        { width, elements: [text('a')] },
        { width: 50, elements: [text('b')] },
      ],
    });

    expect(html).not.toMatch(/undefined|NaN/);
    expect(html.match(/width="50%"/g)).toHaveLength(2);
  });

  it('renders nothing for a row with no columns', () => {
    expect(generateRow({ columns: [] })).toBe('');
    expect(generateRow(null)).toBe('');
  });
});

describe('an image in a column', () => {
  // Outlook on Windows reads the width attribute and ignores max-width: an
  // image wider than its column pushes the whole email wider.
  it('is no wider than its half of the block', () => {
    const html = generateRow(row([50, [image('a')]], [50, [text('b')]]));

    expect(BLOCK_WIDTH).toBe(600);
    expect(imageWidths(html)).toEqual([300]);
    expect(html).toContain('max-width:300px;');
  });

  it('fits each column of 33/33/34, rounded down', () => {
    const html = generateRow(
      row([33, [image('a')]], [33, [image('b')]], [34, [image('c')]])
    );

    expect(imageWidths(html)).toEqual([198, 198, 204]);
  });

  it('leaves room for its own side padding', () => {
    const html = generateRow(
      row([50, [image('a', { paddingLeft: 10, paddingRight: 20 })]], [50, []])
    );

    expect(imageWidths(html)).toEqual([270]);
  });

  it('keeps a width that already fits', () => {
    const html = generateRow(row([66, [image('a', { width: 120 })]], [34, []]));

    expect(imageWidths(html)).toEqual([120]);
  });

  it('is fitted through generate too', () => {
    const html = generate({
      v: 2,
      block: {},
      rows: [row([50, [image('a')]], [50, [text('b')]])],
    });

    expect(imageWidths(html)).toEqual([300]);
  });
});

describe('each element is resolved once', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders each element of a row once, preview chrome included', () => {
    const render = jest.spyOn(elementFor('text'), 'render');

    generateRow(row([50, [text('a'), text('b', '')]], [50, [text('c')]]), {
      elementIds: true,
      starters: { text: { key: 'content', text: 'Votre texte' } },
    });

    expect(render).toHaveBeenCalledTimes(3);
  });
});
