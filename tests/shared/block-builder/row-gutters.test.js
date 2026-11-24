'use strict';

// The desktop gutters between the columns of a row (#1683), one per interval,
// and the widths in px they sit between (ADR 0025, "Row layout"). How a stored
// row is read is row-settings-read.test.js; the mobile half is
// row-stack-spacing.test.js.

const {
  generate,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  generateRow,
  rowClasses,
} = require('../../../packages/shared/block-builder/row-markup.js');
const {
  collectCss,
} = require('../../../packages/shared/block-builder/stylesheet.js');
const {
  row,
  halves,
  thirds,
  composition,
  text,
  image,
  cellsOf,
  styleOf,
  widthOf,
  imageWidths,
} = require('./row-spacing-helpers.js');

const images = (...widths) =>
  widths.map((width, index) => [width, [image(`i${index}`)]]);

describe('the desktop gutters', () => {
  it('pad the cell after each gutter, on its left only', () => {
    const [first, second] = cellsOf(
      generateRow(row(images(290, 290), { gutters: [20] }))
    );

    expect(styleOf(first)).not.toContain('padding');
    expect(styleOf(second)).toMatch(/padding-left:20px;/);
    expect(styleOf(second)).not.toContain('padding-right');
  });

  it('are each set on their own', () => {
    const cells = cellsOf(
      generateRow(row(images(180, 180, 200), { gutters: [8, 32] }))
    );

    expect(cells.map(styleOf)).toEqual([
      expect.not.stringContaining('padding'),
      expect.stringMatching(/padding-left:8px;/),
      expect.stringMatching(/padding-left:32px;/),
    ]);
  });

  it('leave no padding on the outer edges of the row', () => {
    const cells = cellsOf(
      generateRow(row(images(180, 180, 200), { gutters: [8, 32] }))
    );

    expect(styleOf(cells[0])).not.toContain('padding-left');
    cells.forEach((cell) => expect(cell).not.toContain('padding-right'));
  });

  // The review's case: a grid of products with the widest gutters. Every
  // column holds an image of its own width, edges and middle alike.
  it('leave each image exactly its column’s width', () => {
    const html = generateRow(
      row(images(135, 135, 135, 135), { gutters: [20, 20, 20] })
    );

    expect(imageWidths(html)).toEqual([135, 135, 135, 135]);
  });

  it('pad an empty column too, so the columns keep their places', () => {
    const html = generateRow(
      row(
        [
          [290, [text('a')]],
          [290, []],
        ],
        { gutters: [20] }
      )
    );

    expect(styleOf(cellsOf(html)[1])).toMatch(/padding-left:20px;/);
  });
});

describe('the width of a cell', () => {
  it('is its column plus the gutter before it, as a percentage when whole', () => {
    // 288 + 24 = 312: 48% and 52% of the block.
    const cells = cellsOf(
      generateRow(row(images(288, 288), { gutters: [24] }))
    );

    expect(cells.map(widthOf)).toEqual(['48%', '52%']);
    expect(cells.map(styleOf)).toEqual([
      expect.stringMatching(/^width:48%;/),
      expect.stringMatching(/^width:52%;/),
    ]);
  });

  // Outlook reads the attribute, and would round a percentage with decimals.
  it('is in px in the attribute when one cell of the row is not a whole percentage', () => {
    const cells = cellsOf(
      generateRow(row(images(180, 180, 200), { gutters: [8, 32] }))
    );

    expect(cells.map(widthOf)).toEqual(['180', '188', '232']);
    expect(cells.map(styleOf)).toEqual([
      expect.stringMatching(/^width:30%;/),
      expect.stringMatching(/^width:31\.3333%;/),
      expect.stringMatching(/^width:38\.6667%;/),
    ]);
  });

  it('is the percentage it always was for a preset with no gutter', () => {
    const cells = cellsOf(generateRow(row(images(396, 204))));

    expect(cells).toEqual([
      expect.stringContaining('width="66%"'),
      expect.stringContaining('width="34%"'),
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
        halves({ gutters: [0], stackSpacing: 0 }),
        thirds({ gutters: [0, 0], stackSpacing: 0 })
      ),
    ],
    [
      'its widths in percent, as written before px',
      composition(
        row([
          [50, [text('a')]],
          [50, [text('b')]],
        ]),
        row([
          [33, [image('a')]],
          [33, [image('b')]],
          [34, [image('c')]],
        ])
      ),
    ],
  ])('renders byte for byte the same, with %s', (_label, subject) => {
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
  // Only in memory: the modal removes the settings of a row that goes down to
  // one column, and a stored one is read without them.
  it('takes no spacing, whatever it holds', () => {
    const alone = row([[600, [text('a')]]], {
      gutters: [20],
      stackSpacing: 12,
    });
    const html = generateRow(alone);

    expect(html).not.toContain('padding-left');
    expect(html).not.toContain('class=');
    expect(rowClasses(alone)).toEqual([[]]);
  });
});
