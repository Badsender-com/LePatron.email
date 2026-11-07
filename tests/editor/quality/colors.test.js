/**
 * @jest-environment jsdom
 */

'use strict';

const QUALITY = '../../../packages/editor/src/js/ext/quality';
const {
  parseColor,
  contrastRatio,
  backgroundOf,
} = require(`${QUALITY}/colors.js`);
const CSS_NAMED_COLORS = require(`${QUALITY}/css-named-colors.js`);
const {
  parseDeclarations,
  styleValue,
  toPx,
  fontPxOf,
} = require(`${QUALITY}/inline-style.js`);

// The element marked `data-t` of a markup, parsed.
function elementOf(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.querySelector('[data-t]');
}

describe('parseColor', () => {
  it.each([
    ['#FFF', '#ffffff'],
    ['#fffF', '#ffffff'],
    ['#abcdef', '#abcdef'],
    ['#abcdefff', '#abcdef'],
    ['rgb(255, 0, 0)', '#ff0000'],
    ['rgba(0, 0, 0, 1)', '#000000'],
    ['DarkSlateGray', '#2f4f4f'],
    ['rebeccapurple', '#663399'],
  ])('reads %s', (value, hex) => {
    expect(parseColor(value)).toBe(hex);
  });

  it.each(['rgba(0,0,0,0.5)', '#ffffff80', 'var(--brand)', 'transparent', ''])(
    'reads nothing opaque in %s',
    (value) => {
      expect(parseColor(value)).toBeNull();
    }
  );

  it('knows the 148 named colours of CSS', () => {
    expect(Object.keys(CSS_NAMED_COLORS)).toHaveLength(148);
  });
});

describe('contrastRatio', () => {
  it('computes the WCAG 2.1 ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});

describe('backgroundOf', () => {
  it.each([
    ['background: rgb(9, 48, 64) no-repeat top', '#093040'],
    ['background:#fff;background:#000', '#000000'],
    ['background-color: #000 !important', '#000000'],
    ['background: url(tan.jpg) #fff', null],
    ['background-image: url(a.jpg)', null],
  ])('reads %s', (style, hex) => {
    expect(backgroundOf(elementOf(`<p style="${style}" data-t>x</p>`))).toBe(
      hex
    );
  });

  it("reads an ancestor's bgcolor, and white when nothing is declared", () => {
    expect(
      backgroundOf(
        elementOf(
          '<table><tr><td bgcolor="#093040"><span data-t>x</span></td></tr></table>'
        )
      )
    ).toBe('#093040');
    expect(backgroundOf(elementOf('<p><span data-t>x</span></p>'))).toBe(
      '#ffffff'
    );
  });
});

describe('inline-style', () => {
  it('parses declarations, !important dropped, empty ones left out', () => {
    expect(parseDeclarations('color:red; font-size: 1px !important;;')).toEqual(
      [
        { prop: 'color', value: 'red' },
        { prop: 'font-size', value: '1px' },
      ]
    );
  });

  // A data URI carries a `;` of its own, which ends no declaration.
  it('cuts declarations outside parentheses and quotes only', () => {
    expect(
      parseDeclarations(
        'background: url(data:image/png;base64,AAAA) #ff0000; color: #000'
      )
    ).toEqual([
      { prop: 'background', value: 'url(data:image/png;base64,AAAA) #ff0000' },
      { prop: 'color', value: '#000' },
    ]);
    expect(
      parseDeclarations(
        'background-image: url(\'data:image/svg+xml;utf8,<svg/>\');font-family: "a;b", serif'
      )
    ).toEqual([
      {
        prop: 'background-image',
        value: "url('data:image/svg+xml;utf8,<svg/>')",
      },
      { prop: 'font-family', value: '"a;b", serif' },
    ]);
  });

  it('keeps the last declaration of a property, as CSS does', () => {
    const el = elementOf('<p style="color:#fff;color:#000" data-t>x</p>');
    expect(styleValue(el, 'color')).toBe('#000');
    expect(styleValue(el, 'font-size')).toBeUndefined();
  });

  it('converts points and leaves relative units unread', () => {
    expect(toPx('12pt')).toBe(16);
    expect(toPx('14px')).toBe(14);
    expect(toPx('1em')).toBeNull();
    expect(toPx('120%')).toBeNull();
  });

  it('reads the font size an ancestor gives the text', () => {
    const el = elementOf(
      '<div style="font-size:30px !important"><p><span data-t>x</span></p></div>'
    );
    expect(fontPxOf(el)).toBe(30);
  });
});
