'use strict';

// Acceptance tests for the columns slice, at the widest of the four seams
// agreed during the grilling: the generator and the stylesheet function, as
// pure functions over a composition (epic #1194).
//
// Deliberately the biggest of the four. Everything checkable without a DOM is
// checked here, because this is where email-markup regressions actually show —
// a cell that lost its width, a ghost table that came back, an empty column
// that collapsed the layout. None of it needs a browser, and none of it should
// have to go through one.
//
// Written before any implementation exists, so each block requires its module
// inside `beforeAll` rather than at the top of the file.

/** A text element, with an id that says where it sits. */
const textAt = (id, content) => ({ id, type: 'text', content });

/**
 * A composition of rows, each given as a list of column widths with their
 * elements: `rowOf([[50, [el, el]], [50, []]])`.
 */
const rowOf = (columns) => ({
  id: `r-${columns.map(([width]) => width).join('-')}`,
  columns: columns.map(([width, elements]) => ({
    width,
    elements: elements || [],
  })),
});

// Turned on by #1207 (the generator renders rows of columns)
describe.skip('a composition renders as rows of columns', () => {
  let generate;
  let emptyState;

  beforeAll(() => {
    ({
      generate,
      emptyState,
    } = require('../../../packages/shared/block-builder/generate.js'));
  });

  const render = (...rows) => generate({ ...emptyState(), rows });

  describe('the cells', () => {
    it('renders one cell per column, carrying its width', () => {
      const html = render(
        rowOf([
          [50, [textAt('a', 'gauche')]],
          [50, [textAt('b', 'droite')]],
        ])
      );

      expect(html).toContain('width="50%"');
      expect(html.match(/width="50%"/g)).toHaveLength(2);
      expect(html.indexOf('gauche')).toBeLessThan(html.indexOf('droite'));
    });

    it('renders uneven widths as written', () => {
      const html = render(
        rowOf([
          [66, [textAt('a', 'large')]],
          [34, [textAt('b', 'étroit')]],
        ])
      );

      expect(html).toContain('width="66%"');
      expect(html).toContain('width="34%"');
    });

    // The reason no ghost table is needed: real cells, which Outlook lays out
    // natively. A ghost table here would mean the layout was built out of
    // `inline-block` divs instead, which is the approach this slice rejected.
    it('emits no Outlook ghost table for a column', () => {
      const html = render(
        rowOf([
          [50, [textAt('a', 'gauche')]],
          [50, [textAt('b', 'droite')]],
        ])
      );

      expect(html).not.toContain('<!--[if mso');
    });

    it('keeps the elements of a column in their order', () => {
      const html = render(
        rowOf([[100, [textAt('a', 'premier'), textAt('b', 'second')]]])
      );

      expect(html.indexOf('premier')).toBeLessThan(html.indexOf('second'));
    });

    it('renders each row in its own order', () => {
      const html = render(
        rowOf([[100, [textAt('a', 'haut')]]]),
        rowOf([[100, [textAt('b', 'bas')]]])
      );

      expect(html.indexOf('haut')).toBeLessThan(html.indexOf('bas'));
    });

    // An element carries no row of its own inside a cell: a `<tr>` directly
    // inside a `<td>` is invalid, and browsers drop it along with its content.
    it('never puts a row directly inside a cell', () => {
      const html = render(
        rowOf([
          [50, [textAt('a', 'gauche')]],
          [50, [textAt('b', 'droite')]],
        ])
      );

      expect(html.replace(/\s+/g, '')).not.toMatch(/<td[^>]*><tr/i);
    });
  });

  describe('what is empty', () => {
    // The layout would collapse without it: two 50% cells become one full-width
    // cell the moment one of them disappears.
    it('keeps the cell of a column holding nothing', () => {
      const html = render(
        rowOf([
          [50, [textAt('a', 'seul')]],
          [50, []],
        ])
      );

      expect(html.match(/width="50%"/g)).toHaveLength(2);
    });

    // An empty cell retracts in several clients, taking the column's width with
    // it. A zero-sized space holds it open without showing a line.
    it('holds an empty cell open without showing anything', () => {
      const html = render(
        rowOf([
          [50, [textAt('a', 'seul')]],
          [50, []],
        ])
      );

      expect(html).toContain('&nbsp;');
      expect(html).toMatch(/font-size:\s*0/);
    });

    it('drops a row where every column is empty', () => {
      const html = render(
        rowOf([[100, [textAt('a', 'gardée')]]]),
        rowOf([
          [50, []],
          [50, []],
        ])
      );

      expect(html).toContain('gardée');
      expect(html.match(/width="50%"/g)).toBeNull();
    });

    // The existing rule, which must not change: an empty composed block ships
    // nothing at all rather than a bare table.
    it('renders nothing for a composition with no content anywhere', () => {
      expect(render(rowOf([[100, []]]))).toBe('');
      expect(generate({ ...emptyState(), rows: [] })).toBe('');
    });
  });

  describe('what must not change', () => {
    it('still renders a composition written before columns', () => {
      const html = generate({
        ...emptyState(),
        elements: [textAt('a', 'hérité')],
      });

      expect(html).toContain('hérité');
    });

    it('escapes a column width it cannot trust', () => {
      const html = render({
        id: 'r1',
        columns: [
          {
            width: '50"><script>alert(1)</script>',
            elements: [textAt('a', 'x')],
          },
        ],
      });

      expect(html).not.toContain('<script');
    });

    it('survives a row that is not a row', () => {
      expect(() =>
        generate({ ...emptyState(), rows: [null, 'nope', {}, { columns: 42 }] })
      ).not.toThrow();
    });
  });
});

// Turned on by #1208 (a composition derives its stylesheet)
describe.skip('a composition derives its stylesheet', () => {
  let collectCss;
  let emptyState;

  beforeAll(() => {
    ({
      collectCss,
    } = require('../../../packages/shared/block-builder/stylesheet.js'));
    ({
      emptyState,
    } = require('../../../packages/shared/block-builder/generate.js'));
  });

  const cssOf = (...rows) => collectCss({ ...emptyState(), rows });

  it('derives a stacking rule for a row of several columns', () => {
    const css = cssOf(
      rowOf([
        [50, [textAt('a', 'gauche')]],
        [50, [textAt('b', 'droite')]],
      ])
    );

    expect(css).toMatch(/@media[^{]*max-width/);
    expect(css).toMatch(/display:\s*block/);
    expect(css).toMatch(/width:\s*100%/);
  });

  // A single column has nothing to stack, so it must not drag a media query
  // into the head of every mailing that holds a composed block.
  it('derives nothing for a composition of single-column rows', () => {
    expect(cssOf(rowOf([[100, [textAt('a', 'seul')]]]))).toBe('');
  });

  it('derives nothing for an empty composition', () => {
    expect(collectCss({ ...emptyState(), rows: [] })).toBe('');
    expect(collectCss(null)).toBe('');
  });

  // Ten columns sharing one behaviour are one rule. Named by value, so the same
  // behaviour always produces the same name and the rule can be recognised as
  // already emitted.
  it('emits one rule for many columns sharing a behaviour', () => {
    const css = cssOf(
      rowOf([
        [50, [textAt('a', 'a')]],
        [50, [textAt('b', 'b')]],
      ]),
      rowOf([
        [33, [textAt('c', 'c')]],
        [33, [textAt('d', 'd')]],
        [34, [textAt('e', 'e')]],
      ])
    );

    expect(css.match(/display:\s*block/g)).toHaveLength(1);
  });

  // The width travels in the cell, not in a class. This is what makes arbitrary
  // ratios free: a slider would otherwise emit a class per value.
  it('emits no extra rule for an unusual width', () => {
    const even = cssOf(
      rowOf([
        [50, [textAt('a', 'a')]],
        [50, [textAt('b', 'b')]],
      ])
    );
    const odd = cssOf(
      rowOf([
        [37, [textAt('a', 'a')]],
        [63, [textAt('b', 'b')]],
      ])
    );

    expect(odd).toBe(even);
  });

  it('puts every class it emits on the markup it renders', () => {
    const {
      generate,
    } = require('../../../packages/shared/block-builder/generate.js');
    const composition = {
      ...emptyState(),
      rows: [
        rowOf([
          [50, [textAt('a', 'gauche')]],
          [50, [textAt('b', 'droite')]],
        ]),
      ],
    };

    const classes = (
      collectCss(composition).match(/\.([\w-]+)\s*\{/g) || []
    ).map((match) => match.replace(/[.{\s]/g, ''));

    expect(classes.length).toBeGreaterThan(0);
    classes.forEach((name) => {
      expect(generate(composition)).toContain(name);
    });
  });
});
