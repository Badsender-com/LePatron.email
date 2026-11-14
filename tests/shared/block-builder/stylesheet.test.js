'use strict';

// What the acceptance tests of #1208 do not say, and what breaks silently.
//
// The failure mode this file exists for: a rule that is present, on a class
// that is present, on the right element — and nothing moves. That is what
// happens without `!important`, and it looks exactly like success until
// someone opens the email on a phone.

const {
  collectCss,
  classesOf,
  BREAKPOINT,
} = require('../../../packages/shared/block-builder/stylesheet.js');
const {
  generate,
} = require('../../../packages/shared/block-builder/generate.js');

const text = (id) => ({ id, type: 'text', content: id });

const composition = (...rows) => ({
  v: 2,
  gen: '1.0.0',
  block: {},
  rows: rows.map((widths, index) => ({
    id: `r${index}`,
    columns: widths.map((width, column) => ({
      width,
      elements: [text(`e${index}-${column}`)],
    })),
  })),
});

describe('beating the inline width', () => {
  // The cell carries its width inline — Outlook reads the attribute,
  // everything else reads the style — and a class on the SAME element still
  // loses to an inline declaration without `!important`.
  it('marks the stacking declarations important', () => {
    const css = collectCss(composition([50, 50]));

    expect(css).toMatch(/display:\s*block\s*!important/);
    expect(css).toMatch(/width:\s*100%\s*!important/);
  });

  // The thing the rule has to beat, pinned here so that moving the width out
  // of the inline style does not quietly make `!important` look unnecessary.
  it('is up against a width the cell carries inline', () => {
    const html = generate(composition([50, 50]));

    expect(html).toMatch(/style="[^"]*width:50%/);
  });
});

describe('the media query', () => {
  it('is a max-width at the width the composition is laid out for', () => {
    expect(collectCss(composition([50, 50]))).toContain(
      `max-width:${BREAKPOINT}px`
    );
    expect(BREAKPOINT).toBe(600);
  });

  it('wraps every rule in one query rather than one each', () => {
    const css = collectCss(composition([50, 50], [33, 33, 34]));

    expect(css.match(/@media/g)).toHaveLength(1);
  });
});

describe('what asks for a class', () => {
  test.each([
    ['two columns', [50, 50], 1],
    ['three columns', [33, 33, 34], 1],
    ['one column', [100], 0],
  ])('%s asks for %i', (_label, widths, expected) => {
    expect(classesOf(composition(widths))).toHaveLength(expected);
  });

  it('asks once for rows that behave the same way', () => {
    expect(classesOf(composition([50, 50], [25, 25, 25, 25]))).toHaveLength(1);
  });

  // A composition is read from a database and may be anything.
  test.each([
    ['null', null],
    ['no rows', { rows: null }],
    ['a row that is not one', { rows: [null, 42, 'nope'] }],
    ['columns that are not an array', { rows: [{ columns: 'two' }] }],
  ])('survives %s', (_label, value) => {
    expect(() => collectCss(value)).not.toThrow();
    expect(collectCss(value)).toBe('');
  });
});

describe('the markup and the stylesheet agree', () => {
  // The two are separate derivations of one composition, which is the point —
  // and also the risk. Nothing but a test keeps them in step.
  it('emits no class the markup does not carry', () => {
    const subject = composition([50, 50], [100], [33, 33, 34]);
    const html = generate(subject);

    classesOf(subject).forEach((name) => {
      expect(html).toContain(`class="${name}"`);
    });
  });

  it('leaves no class in the markup the stylesheet does not define', () => {
    const subject = composition([50, 50]);
    const css = collectCss(subject);

    const used = new Set();
    (generate(subject).match(/class="([^"]*)"/g) || []).forEach((attribute) => {
      attribute
        .replace(/^class="|"$/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .forEach((name) => used.add(name));
    });

    expect(used.size).toBeGreaterThan(0);
    used.forEach((name) => expect(css).toContain(`.${name}{`));
  });
});
