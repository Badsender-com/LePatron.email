'use strict';

const ko = require('knockout');
const {
  isSyntheticBlock,
  isEmptySyntheticBlock,
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

describe('isSyntheticBlock', () => {
  it('recognises a plain palette definition', () => {
    expect(isSyntheticBlock(plainBlock(''))).toBe(true);
  });

  it('recognises a fully wrapped canvas instance', () => {
    expect(isSyntheticBlock(wrappedBlock(''))).toBe(true);
  });

  it('recognises a block whose properties alone are observable', () => {
    expect(isSyntheticBlock(halfWrappedBlock(''))).toBe(true);
  });

  it('rejects any other block type, in every shape', () => {
    expect(isSyntheticBlock({ type: 'textBlock' })).toBe(false);
    expect(isSyntheticBlock({ type: ko.observable('textBlock') })).toBe(false);
    expect(
      isSyntheticBlock(ko.observable({ type: ko.observable('textBlock') }))
    ).toBe(false);
  });

  it('tolerates missing or malformed input', () => {
    expect(isSyntheticBlock(null)).toBe(false);
    expect(isSyntheticBlock(undefined)).toBe(false);
    expect(isSyntheticBlock({})).toBe(false);
    expect(isSyntheticBlock(ko.observable(null))).toBe(false);
    expect(isSyntheticBlock(ko.observable(undefined))).toBe(false);
  });
});

describe('isEmptySyntheticBlock', () => {
  // The regression: with an observable `type`, this used to return false for
  // every block, so the placeholder never rendered and an empty block was 0px
  // tall and unselectable in the canvas.
  it('is true for an empty wrapped canvas instance', () => {
    expect(isEmptySyntheticBlock(wrappedBlock(''))).toBe(true);
  });

  it('is true for an empty block whose properties alone are observable', () => {
    expect(isEmptySyntheticBlock(halfWrappedBlock(''))).toBe(true);
  });

  it('is true for an empty plain block', () => {
    expect(isEmptySyntheticBlock(plainBlock(''))).toBe(true);
  });

  it('is true when the markup property is absent or nullish', () => {
    expect(isEmptySyntheticBlock({ type: 'htmlCodeBlock' })).toBe(true);
    expect(isEmptySyntheticBlock(plainBlock(null))).toBe(true);
    expect(
      isEmptySyntheticBlock({
        type: ko.observable('htmlCodeBlock'),
        htmlCode: ko.observable(null),
      })
    ).toBe(true);
  });

  it('is false as soon as markup is present', () => {
    expect(isEmptySyntheticBlock(wrappedBlock('<table></table>'))).toBe(false);
    expect(isEmptySyntheticBlock(plainBlock('<table></table>'))).toBe(false);
    expect(isEmptySyntheticBlock(halfWrappedBlock('x'))).toBe(false);
  });

  it('follows the observable when markup is pasted, then cleared', () => {
    const block = halfWrappedBlock('');
    expect(isEmptySyntheticBlock(block)).toBe(true);

    block.htmlCode('<table></table>');
    expect(isEmptySyntheticBlock(block)).toBe(false);

    block.htmlCode('');
    expect(isEmptySyntheticBlock(block)).toBe(true);
  });

  it('is false for other block types, however empty', () => {
    expect(isEmptySyntheticBlock({ type: 'textBlock', text: '' })).toBe(false);
    expect(
      isEmptySyntheticBlock({
        type: ko.observable('textBlock'),
        text: ko.observable(''),
      })
    ).toBe(false);
  });

  it('tolerates missing or malformed input', () => {
    expect(isEmptySyntheticBlock(null)).toBe(false);
    expect(isEmptySyntheticBlock(undefined)).toBe(false);
    expect(isEmptySyntheticBlock({})).toBe(false);
  });
});
