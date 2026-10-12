'use strict';

// A slot's context lives in the manifest and its position in the .vue, and the
// compiler checks the two against each other on the rendered markup.

const {
  positionsOf,
} = require('../../../../scripts/block-builder/slot-placement.js');
const {
  compileComponent,
  listComponents,
} = require('../../../../scripts/block-builder/compile-component.js');
const { compileFixture } = require('./fixture.js');

const S = 'LPSLOTxX1';

describe('positionsOf', () => {
  it.each([
    [`<td>${S}</td>`, ['text']],
    [`<td title="${S}">x</td>`, ['attribute']],
    [`<td style="color:${S};">x</td>`, ['style']],
    [`<a href="${S}">x</a>`, ['url']],
    [`<img src=" ${S} " />`, ['url']],
    [`<a href="https://example.com/?q=${S}">x</a>`, ['part of a URL']],
    [`<td onclick="${S}">x</td>`, ['event handler']],
    [`<td data-${S}="1">x</td>`, ['attribute name']],
    [`<!-- ${S} --><td>x</td>`, ['comment']],
    [`<td title="${S}">${S}</td>`, ['attribute', 'text']],
    ['<td title="a > b">x</td>', []],
  ])('%s', (html, expected) => {
    expect(positionsOf(html, S)).toEqual(expected);
  });
});

const table = (cell) => `<table><tr>${cell}</tr></table>`;

// The `${x}` below are Vue template literals, compiled by Vue, not JavaScript.
/* eslint-disable no-template-curly-in-string */

describe('a slot whose context does not fit its position', () => {
  it.each([
    [
      'TEXT in an attribute',
      'TEXT',
      '<td :title="x">x</td>',
      /is TEXT but lands in attribute/,
    ],
    [
      'RICH_TEXT in an attribute',
      'RICH_TEXT',
      '<td :title="x">x</td>',
      /is RICH_TEXT but lands in attribute/,
    ],
    [
      'ATTR in a style',
      'ATTR',
      '<td :style="`color:${x};`">x</td>',
      /is ATTR but lands in style/,
    ],
    [
      'ATTR in an href',
      'ATTR',
      '<td><a :href="x">x</a></td>',
      /is ATTR but lands in url/,
    ],
    ['URL in text', 'URL', '<td>{{ x }}</td>', /is URL but lands in text/],
    [
      'URL as part of an href',
      'URL',
      '<td><a :href="`https://example.com/${x}`">a</a></td>',
      /lands in part of a URL, which takes nothing/,
    ],
    [
      'COLOR in text',
      'COLOR',
      '<td>{{ x }}</td>',
      /is COLOR but lands in text/,
    ],
  ])('fails the build: %s', async (_, context, cell, message) => {
    await expect(
      compileFixture({ slots: { x: { context } }, template: table(cell) })
    ).rejects.toThrow(message);
  });

  it('fails when one prop lands where no single context fits', async () => {
    await expect(
      compileFixture({
        slots: { x: { context: 'TEXT' } },
        template: table('<td><a :href="x">{{ x }}</a></td>'),
      })
    ).rejects.toThrow(/"x" lands in url and text, which no single context/);
  });

  it.each([
    ['TEXT in text', 'TEXT', '<td>{{ x }}</td>'],
    ['RICH_TEXT in text', 'RICH_TEXT', '<td v-html="x"></td>'],
    ['URL as a whole href', 'URL', '<td><a :href="x">a</a></td>'],
    ['ATTR in an attribute', 'ATTR', '<td :align="x">a</td>'],
    [
      'COLOR in a style and an attribute',
      'COLOR',
      '<td :bgcolor="x" :style="`color:${x};`">a</td>',
    ],
    ['PX in a style', 'PX', '<td :style="`width:${x}px;`">a</td>'],
    [
      'CSS_VALUE in a style',
      'CSS_VALUE',
      '<td :style="`font-family:${x};`">a</td>',
    ],
  ])('accepts %s', async (_, context, cell) => {
    await expect(
      compileFixture({ slots: { x: { context } }, template: table(cell) })
    ).resolves.toHaveProperty('default');
  });
});

/* eslint-enable no-template-curly-in-string */

describe('the real components', () => {
  test.each(listComponents())('%s places every slot where it fits', (name) =>
    expect(compileComponent(name)).resolves.toContain('module.exports')
  );
});
