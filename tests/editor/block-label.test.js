'use strict';

// One name for a block, in every panel (ADR 0020): « Cover · bloc 2 ».

const ko = require('knockout');
const {
  blockLabel,
  blockTypeName,
} = require('../../packages/editor/src/js/ext/block-label.js');

function viewModelWith(blocks, names = {}) {
  return {
    templateBlockNames: names,
    ut: (category, key) => `${category}:${key}`,
    t: (key, params = {}) => `${key}(${params.place})`,
    content: () => ({
      mainBlocks: () => ({
        blocks: ko.observableArray(
          blocks.map((block) => ({
            id: ko.observable(block.id),
            type: ko.observable(block.type),
          }))
        ),
      }),
    }),
  };
}

describe('the name of a block', () => {
  it('is the template’s name for its type, in the user’s language', () => {
    const vm = viewModelWith([], { largecoverBlock: 'Cover' });
    expect(blockTypeName(vm, 'largecoverBlock')).toBe('template:Cover');
  });

  it('is its type made readable when the template names it not', () => {
    expect(blockTypeName(viewModelWith([]), 'largecoverBlock')).toBe(
      'Largecover'
    );
  });

  it('says its place among the blocks of the email', () => {
    const vm = viewModelWith(
      [
        { id: 'ko_textBlock_1', type: 'textBlock' },
        { id: 'ko_largecoverBlock_2', type: 'largecoverBlock' },
      ],
      { largecoverBlock: 'Cover' }
    );
    expect(blockLabel(vm, 'ko_largecoverBlock_2')).toBe(
      'template:Cover · comments-block-place(2)'
    );
    expect(blockLabel(vm, 'ko_textBlock_1')).toBe(
      'Text · comments-block-place(1)'
    );
  });

  it('names a fixed block of the template by its type alone', () => {
    const vm = viewModelWith([], { headerBlock: 'En-tête' });
    expect(blockLabel(vm, 'ko_headerBlock_3')).toBe('template:En-tête');
  });

  it('keeps an id it cannot read, and says nothing without one', () => {
    const vm = viewModelWith([]);
    expect(blockLabel(vm, 'odd')).toBe('odd');
    expect(blockLabel(vm, null)).toBe('');
  });

  it('holds without a main container', () => {
    const vm = { ...viewModelWith([]), content: () => ({}) };
    expect(blockLabel(vm, 'ko_heroBlock_1')).toBe('Hero');
  });
});
