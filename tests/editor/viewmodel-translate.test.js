/**
 * @jest-environment jsdom
 */

'use strict';

const ko = require('knockout');

global.ko = ko;
global.$ = global.jQuery = require('jquery');

const initializeEditor = require('../../packages/editor/src/js/viewmodel.js');

const content = ko.observable({
  mainBlocks: ko.observable({ blocks: ko.observableArray([]) }),
});
const viewModel = initializeEditor(content, [], (path) => path, '');

describe('viewModel.tt', () => {
  it('substitutes every occurrence of a parameter', () => {
    expect(viewModel.tt('__n__ of __n__', { n: 2 })).toBe('2 of 2');
  });

  // Quality findings quote a link label, which is the email's own content.
  it('prints a value with replacement patterns as is', () => {
    const label = "Save $& more, $` and $' too $$";
    expect(viewModel.tt('Link not filled in: __label__', { label })).toBe(
      `Link not filled in: ${label}`
    );
  });
});
