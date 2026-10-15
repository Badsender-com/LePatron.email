/**
 * @jest-environment jsdom
 */

'use strict';

const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const {
  visibleTextOf,
  isShown,
  blockLinks,
  excerpt,
} = require('../../../packages/editor/src/js/ext/quality/exported-content.js');
const { fakeViewModel, exportOf } = require('./fake-view-model');

const parse = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
};

describe('visibleTextOf', () => {
  it.each([
    'display:none',
    'display: none !important',
    'visibility:hidden',
    'opacity:0',
    'opacity: 0.0',
    'max-height:0',
    'max-height:0px',
  ])('leaves out text hidden by %s', (style) => {
    expect(
      visibleTextOf(parse(`<p>Shown</p><span style="${style}">Hidden</span>`))
    ).toBe('Shown');
  });

  it('keeps text hidden from Outlook only, and leaves stylesheets out', () => {
    expect(
      visibleTextOf(
        parse(
          '<style>p { color: red }</style><span style="mso-hide:all">Still read</span>'
        )
      )
    ).toBe('Still read');
  });

  it('keeps the words of two cells apart', () => {
    expect(
      visibleTextOf(parse('<table><tr><td>One</td><td>Two</td></tr></table>'))
    ).toBe('One Two');
  });
});

describe('isShown', () => {
  it('is false under a hidden ancestor, up to the root', () => {
    const root = parse('<div style="display:none"><p><img></p></div>');
    expect(isShown(root.querySelector('img'), root)).toBe(false);
    expect(isShown(root.querySelector('img'), root.querySelector('p'))).toBe(
      true
    );
  });
});

describe('blockLinks', () => {
  it('tells a dynamic host from a dynamic query', () => {
    let links;
    const reader = {
      id: 'reader',
      run: (ctx) => {
        links = blockLinks(ctx).map(({ dynamic, dynamicHost }) => [
          dynamic,
          dynamicHost,
        ]);
        return [];
      },
    };
    const html = exportOf({
      b1: [
        '<a href="https://{{domain}}/x">a</a>',
        '<a href="https://brand.com/?u={{email}}">b</a>',
        '<a href="{{unsubscribe_url}}">c</a>',
        '<a href="https://brand.com">d</a>',
      ].join(''),
    });
    runQualityChecks(
      fakeViewModel({ blocks: [{ id: 'b1', type: 'textBlock' }], html }),
      {
        rules: [reader],
      }
    );
    expect(links).toEqual([
      [true, true],
      [true, false],
      [true, true],
      [false, false],
    ]);
  });
});

describe('excerpt', () => {
  it('keeps the start of a long text', () => {
    expect(excerpt('a'.repeat(50))).toBe(`${'a'.repeat(40)}…`);
    expect(excerpt('short')).toBe('short');
  });
});
