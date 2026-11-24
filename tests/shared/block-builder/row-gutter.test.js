'use strict';

// The desktop gutter between the columns of a row (#1683), and how a stored
// row's spacing settings are read (ADR 0025, "Row settings"). The mobile half,
// the stack spacing, is row-stack-spacing.test.js.

const {
  generate,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  generateRow,
  rowClasses,
} = require('../../../packages/shared/block-builder/row-markup.js');
const {
  parseState,
  serialiseState,
} = require('../../../packages/shared/block-builder/state.js');
const {
  collectCss,
} = require('../../../packages/shared/block-builder/stylesheet.js');
const {
  MAX_GUTTER,
  MAX_STACK_SPACING,
  gutterSides,
} = require('../../../packages/shared/block-builder/row-spacing.js');
const {
  row,
  halves,
  thirds,
  composition,
  text,
  image,
  cellsOf,
  styleOf,
  imageWidths,
} = require('./row-spacing-helpers.js');

describe('the desktop gutter', () => {
  it('pads only the sides of a cell that face another column', () => {
    const [first, last] = cellsOf(generateRow(halves({ gutter: 20 })));

    expect(styleOf(first)).toMatch(/padding-left:0px;\s*padding-right:10px;/);
    expect(styleOf(last)).toMatch(/padding-left:10px;\s*padding-right:0px;/);
  });

  it('pads both sides of a middle column', () => {
    const cells = cellsOf(generateRow(thirds({ gutter: 16 })));

    expect(cells.map(styleOf)).toEqual([
      expect.stringMatching(/padding-left:0px;\s*padding-right:8px;/),
      expect.stringMatching(/padding-left:8px;\s*padding-right:8px;/),
      expect.stringMatching(/padding-left:8px;\s*padding-right:0px;/),
    ]);
  });

  // Every value a user can type must come out as the gap they asked for.
  test.each([1, 7, 13, MAX_GUTTER - 1])(
    'leaves exactly %ipx between two columns, odd or even',
    (gutter) => {
      const left = gutterSides(0, 3, gutter);
      const middle = gutterSides(1, 3, gutter);
      const right = gutterSides(2, 3, gutter);

      expect(left.right + middle.left).toBe(gutter);
      expect(middle.right + right.left).toBe(gutter);
      expect(left.left).toBe(0);
      expect(right.right).toBe(0);
    }
  );

  it('keeps the percentage widths of the cells', () => {
    const cells = cellsOf(generateRow(thirds({ gutter: 16 })));

    expect(cells.map((cell) => cell.match(/width="([^"]*)"/)[1])).toEqual([
      '33%',
      '33%',
      '34%',
    ]);
  });

  it('pads an empty column too, so the columns keep their places', () => {
    const html = generateRow(
      row(
        [
          [50, [text('a')]],
          [50, []],
        ],
        { gutter: 20 }
      )
    );

    expect(styleOf(cellsOf(html)[1])).toMatch(/padding-left:10px;/);
  });

  // Outlook on Windows lays an image out at its width attribute: in a padded
  // column it must leave the padding room.
  it('gives an image its column minus the gutter beside it', () => {
    const html = generateRow(
      row(
        [
          [50, [image('a')]],
          [50, [image('b')]],
        ],
        { gutter: 20 }
      )
    );

    expect(imageWidths(html)).toEqual([290, 290]);
  });

  it('gives an image in a middle column the room both halves leave', () => {
    // 33% of 600 is 198, 34% is 204.
    expect(imageWidths(generateRow(thirds({ gutter: 16 })))).toEqual([
      190,
      182,
      196,
    ]);
  });
});

describe('a row at the defaults', () => {
  const plain = composition(halves(), thirds());

  test.each([
    ['no setting', composition(halves(), thirds())],
    [
      'settings at 0',
      composition(
        halves({ gutter: 0, stackSpacing: 0 }),
        thirds({ gutter: 0, stackSpacing: 0 })
      ),
    ],
  ])('renders byte for byte as before, with %s', (_label, subject) => {
    expect(generate(subject)).toBe(generate(plain));
    expect(generate(subject, { chrome: true, elementIds: true })).toBe(
      generate(plain, { chrome: true, elementIds: true })
    );
    expect(collectCss(subject)).toBe(collectCss(plain));
  });

  it('ships no padding on its cells', () => {
    cellsOf(generate(plain)).forEach((cell) =>
      expect(cell).not.toContain('padding')
    );
  });
});

describe('a row of one column', () => {
  const alone = row([[100, [text('a')]]], { gutter: 20, stackSpacing: 12 });

  // Only in memory: the modal removes the settings of a row that goes down to
  // one column, and a stored one is read without them (below).
  it('takes no spacing, whatever it holds', () => {
    const html = generateRow(alone);

    expect(html).not.toContain('padding-left');
    expect(html).not.toContain('class=');
    expect(rowClasses(alone)).toEqual(['']);
  });

  it('is read without them, and stays flat', () => {
    const read = parseState(JSON.stringify({ v: 2, rows: [alone] }));

    expect(Object.keys(read.rows[0]).sort()).toEqual(['columns', 'id']);
    expect(JSON.parse(serialiseState(read)).v).toBe(1);
  });
});

describe('reading the settings of a stored row', () => {
  const readRow = (settings) =>
    parseState(JSON.stringify({ v: 2, rows: [halves(settings)] })).rows[0];

  it('keeps settings within the bounds as they are', () => {
    expect(readRow({ gutter: 20, stackSpacing: 12 })).toMatchObject({
      gutter: 20,
      stackSpacing: 12,
    });
  });

  test.each([
    ['past the maximum', 55, MAX_GUTTER],
    ['a fraction', 12.6, 13],
  ])('brings a gutter %s within them', (_label, stored, expected) => {
    expect(readRow({ gutter: stored }).gutter).toBe(expected);
  });

  test.each([
    ['negative', -8],
    ['zero', 0],
    ['text', '12'],
    ['markup', '12px;}body{color:red'],
    ['not a number', NaN],
    ['infinite', Infinity],
    ['null', null],
    ['an object', { px: 12 }],
  ])('drops a gutter that is %s', (_label, stored) => {
    expect(readRow({ gutter: stored })).not.toHaveProperty('gutter');
  });

  test.each([
    ['on a step', 12, 12],
    ['between two steps', 13, 12],
    ['half a step up', 14, 16],
    ['past the maximum', 99, MAX_STACK_SPACING],
  ])('reads a stack spacing %s', (_label, stored, expected) => {
    expect(readRow({ stackSpacing: stored }).stackSpacing).toBe(expected);
  });

  test.each([
    ['below half a step', 1],
    ['negative', -12],
    ['text', 'large'],
  ])('drops a stack spacing %s', (_label, stored) => {
    expect(readRow({ stackSpacing: stored })).not.toHaveProperty(
      'stackSpacing'
    );
  });

  it('writes no value the markup could not hold', () => {
    const html = generate(
      composition(halves({ gutter: '12px;}body{', stackSpacing: '1;}' }))
    );

    expect(html).not.toContain('body{');
    cellsOf(html).forEach((cell) => expect(cell).not.toContain('padding'));
  });
});
