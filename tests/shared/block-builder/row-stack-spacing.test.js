'use strict';

// The mobile half of the space between columns (#1683): the classes a stacked
// row's cells carry, and the derived stylesheet that defines them. The desktop
// gutters are row-gutters.test.js.

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
  GENERATED_CLASSES,
  MOBILE_DECLARATIONS,
} = require('../../../packages/shared/block-builder/generated-classes.js');
const {
  MAX_STACK_SPACING,
  normaliseStackSpacing,
} = require('../../../packages/shared/block-builder/row-spacing.js');
const {
  row,
  halves,
  thirds,
  composition,
  image,
  cellsOf,
} = require('./row-spacing-helpers.js');

describe('the mobile classes of a row', () => {
  it('drop the gutter on every cell that has one before it', () => {
    expect(rowClasses(thirds({ gutters: [20, 0] }))).toEqual([
      ['lp-stack'],
      ['lp-stack', 'lp-gutter'],
      ['lp-stack'],
    ]);
  });

  it('keep the stack spacing under every cell but the last', () => {
    expect(rowClasses(thirds({ stackSpacing: 12 }))).toEqual([
      ['lp-stack', 'lp-stack-spacing-12'],
      ['lp-stack', 'lp-stack-spacing-12'],
      ['lp-stack'],
    ]);
  });

  it('carry both, independently', () => {
    expect(rowClasses(halves({ gutters: [8], stackSpacing: 24 }))).toEqual([
      ['lp-stack', 'lp-stack-spacing-24'],
      ['lp-stack', 'lp-gutter'],
    ]);
  });

  it('are the classes the cells carry', () => {
    const subject = halves({ gutters: [8], stackSpacing: 24 });
    const cells = cellsOf(generateRow(subject));

    expect(cells.map((cell) => cell.match(/class="([^"]*)"/)[1])).toEqual(
      rowClasses(subject).map((classes) => classes.join(' '))
    );
  });

  it('have a class for every px of the stack spacing', () => {
    for (let spacing = 1; spacing <= MAX_STACK_SPACING; spacing += 1) {
      expect(GENERATED_CLASSES).toContain(`lp-stack-spacing-${spacing}`);
    }
  });

  it('keep a stack spacing of 13 as 13', () => {
    expect(normaliseStackSpacing(13)).toBe(13);
    expect(rowClasses(halves({ stackSpacing: 13 }))).toEqual([
      ['lp-stack', 'lp-stack-spacing-13'],
      ['lp-stack'],
    ]);
  });
});

// An empty column takes no room once stacked: the spacing goes only between
// two columns that hold something, or it leaves a blank band.
describe('the stack spacing beside an empty column', () => {
  const SPACED = 'lp-stack-spacing-16';
  const spacedCells = (...filled) =>
    rowClasses(
      row(
        filled.map((holds, index) => [
          index === filled.length - 1 ? 600 - 200 * (filled.length - 1) : 200,
          holds ? [image(`i${index}`)] : [],
        ]),
        { stackSpacing: 16 }
      )
    ).map((classes) => classes.includes(SPACED));

  it('is not under an image followed by an empty column', () => {
    expect(spacedCells(true, false)).toEqual([false, false]);
  });

  it('is not above an image that follows an empty column', () => {
    expect(spacedCells(false, true)).toEqual([false, false]);
  });

  it('is once between two images an empty column separates', () => {
    expect(spacedCells(true, false, true)).toEqual([true, false, false]);
  });
});

describe('the mobile declarations', () => {
  it('take the desktop gutter away', () => {
    expect(MOBILE_DECLARATIONS['lp-gutter']).toBe(
      'padding-left:0 !important;padding-right:0 !important;'
    );
  });

  it('put the stack spacing under the cell', () => {
    expect(MOBILE_DECLARATIONS['lp-stack-spacing-12']).toBe(
      'padding-bottom:12px !important;'
    );
  });
});

describe('the derived stylesheet of a row with spacing', () => {
  const RULE = /\.([\w-]+)\{([^}]*)\}/g;
  const rulesOf = (css) => Array.from(css.matchAll(RULE));

  it('holds the gutter and the spacing rules', () => {
    const css = collectCss(
      composition(halves({ gutters: [8], stackSpacing: 24 }))
    );

    expect(css).toContain('.lp-gutter{padding-left:0 !important;');
    expect(css).toContain(
      '.lp-stack-spacing-24{padding-bottom:24px !important;}'
    );
  });

  // The security review's condition: the stylesheet is made of rules the
  // generator owns, from a closed list, never of a stored value.
  it('holds only rules from the closed list, whatever is stored', () => {
    const css = collectCss(
      composition(
        halves({ gutters: [17], stackSpacing: 12.6 }),
        thirds({ gutters: ['9;}body{', 7], stackSpacing: '}*{color:red' })
      )
    );

    expect(rulesOf(css).length).toBeGreaterThan(0);
    rulesOf(css).forEach(([, name, declarations]) => {
      expect(GENERATED_CLASSES).toContain(name);
      expect(declarations).toBe(MOBILE_DECLARATIONS[name]);
    });
    expect(css).toContain('.lp-stack-spacing-13{padding-bottom:13px');
    expect(css).not.toContain('12.6');
    expect(css).not.toContain('17');
    expect(css).not.toContain('color');
  });

  // Forty classes in the list, but a stylesheet only holds the ones its
  // composition uses.
  it('holds only the spacing rules the rows use', () => {
    const css = collectCss(
      composition(
        halves({ stackSpacing: 13 }),
        thirds({ stackSpacing: 13 }),
        halves({ stackSpacing: 4 })
      )
    );

    expect(
      rulesOf(css)
        .map(([, name]) => name)
        .filter((name) => name.startsWith('lp-stack-spacing-'))
    ).toEqual(['lp-stack-spacing-13', 'lp-stack-spacing-4']);
  });

  it('defines every class the markup carries', () => {
    const subject = composition(
      halves({ gutters: [8], stackSpacing: 24 }),
      thirds({ stackSpacing: 4 })
    );
    const css = collectCss(subject);
    const used = new Set(
      (generate(subject).match(/class="([^"]*)"/g) || []).flatMap((attribute) =>
        attribute.replace(/^class="|"$/g, '').split(/\s+/)
      )
    );

    expect(used).toEqual(
      new Set([
        'lp-stack',
        'lp-gutter',
        'lp-stack-spacing-24',
        'lp-stack-spacing-4',
      ])
    );
    used.forEach((name) => expect(css).toContain(`.${name}{`));
  });
});
