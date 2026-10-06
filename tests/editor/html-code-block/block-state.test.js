'use strict';

const ko = require('knockout');
const {
  isHtmlCodeBlock,
  isEmptyHtmlCodeBlock,
} = require('../../../packages/editor/src/js/ext/html-code-block/block-state.js');

// Blocks reach these predicates in two very different shapes, and the difference
// is what broke the empty-block placeholder the first time round:
//   - palette definition: a plain object, `type` is a string
//   - canvas instance: the block AND each of its properties are observables
// Real Knockout observables are used here rather than stand-ins, because the bug
// was precisely that comparing an observable to a string silently yields false.
const plainBlock = (html) => ({ type: 'htmlCodeBlock', htmlCode: html });

const wrappedBlock = (html) =>
  ko.observable({
    type: ko.observable('htmlCodeBlock'),
    htmlCode: ko.observable(html),
  });

// Only the properties are observable, not the block itself.
const halfWrappedBlock = (html) => ({
  type: ko.observable('htmlCodeBlock'),
  htmlCode: ko.observable(html),
});

describe('isHtmlCodeBlock', () => {
  it('recognises a plain palette definition', () => {
    expect(isHtmlCodeBlock(plainBlock(''))).toBe(true);
  });

  it('recognises a fully wrapped canvas instance', () => {
    expect(isHtmlCodeBlock(wrappedBlock(''))).toBe(true);
  });

  it('recognises a block whose properties alone are observable', () => {
    expect(isHtmlCodeBlock(halfWrappedBlock(''))).toBe(true);
  });

  it('rejects any other block type, in every shape', () => {
    expect(isHtmlCodeBlock({ type: 'textBlock' })).toBe(false);
    expect(isHtmlCodeBlock({ type: ko.observable('textBlock') })).toBe(false);
    expect(
      isHtmlCodeBlock(ko.observable({ type: ko.observable('textBlock') }))
    ).toBe(false);
  });

  it('tolerates missing or malformed input', () => {
    expect(isHtmlCodeBlock(null)).toBe(false);
    expect(isHtmlCodeBlock(undefined)).toBe(false);
    expect(isHtmlCodeBlock({})).toBe(false);
    expect(isHtmlCodeBlock(ko.observable(null))).toBe(false);
    expect(isHtmlCodeBlock(ko.observable(undefined))).toBe(false);
  });
});

describe('isEmptyHtmlCodeBlock', () => {
  // The regression: with an observable `type`, this used to return false for
  // every block, so the placeholder never rendered and an empty block was 0px
  // tall and unselectable in the canvas.
  it('is true for an empty wrapped canvas instance', () => {
    expect(isEmptyHtmlCodeBlock(wrappedBlock(''))).toBe(true);
  });

  it('is true for an empty block whose properties alone are observable', () => {
    expect(isEmptyHtmlCodeBlock(halfWrappedBlock(''))).toBe(true);
  });

  it('is true for an empty plain block', () => {
    expect(isEmptyHtmlCodeBlock(plainBlock(''))).toBe(true);
  });

  it('is true when the markup property is absent or nullish', () => {
    expect(isEmptyHtmlCodeBlock({ type: 'htmlCodeBlock' })).toBe(true);
    expect(isEmptyHtmlCodeBlock(plainBlock(null))).toBe(true);
    expect(
      isEmptyHtmlCodeBlock({
        type: ko.observable('htmlCodeBlock'),
        htmlCode: ko.observable(null),
      })
    ).toBe(true);
  });

  it('is false as soon as markup is present', () => {
    expect(isEmptyHtmlCodeBlock(wrappedBlock('<table></table>'))).toBe(false);
    expect(isEmptyHtmlCodeBlock(plainBlock('<table></table>'))).toBe(false);
    expect(isEmptyHtmlCodeBlock(halfWrappedBlock('x'))).toBe(false);
  });

  it('follows the observable when markup is pasted, then cleared', () => {
    const block = halfWrappedBlock('');
    expect(isEmptyHtmlCodeBlock(block)).toBe(true);

    block.htmlCode('<table></table>');
    expect(isEmptyHtmlCodeBlock(block)).toBe(false);

    block.htmlCode('');
    expect(isEmptyHtmlCodeBlock(block)).toBe(true);
  });

  it('is false for other block types, however empty', () => {
    expect(isEmptyHtmlCodeBlock({ type: 'textBlock', text: '' })).toBe(false);
    expect(
      isEmptyHtmlCodeBlock({
        type: ko.observable('textBlock'),
        text: ko.observable(''),
      })
    ).toBe(false);
  });

  it('tolerates missing or malformed input', () => {
    expect(isEmptyHtmlCodeBlock(null)).toBe(false);
    expect(isEmptyHtmlCodeBlock(undefined)).toBe(false);
    expect(isEmptyHtmlCodeBlock({})).toBe(false);
  });
});
