/**
 * @jest-environment jsdom
 */

'use strict';

const {
  findBlockById,
} = require('../../../packages/editor/src/js/ext/block-navigation.js');
const { fakeViewModel } = require('./fake-view-model');

describe('findBlockById', () => {
  it('finds a block in any container, as the quality engine judges them all', () => {
    const viewModel = fakeViewModel({
      blocks: [{ id: 'main-1', type: 'textBlock' }],
      containers: { footerBlocks: [{ id: 'footer-1', type: 'footerBlock' }] },
    });

    expect(findBlockById(viewModel, 'main-1')).toMatchObject({ id: 'main-1' });
    expect(findBlockById(viewModel, 'footer-1')).toMatchObject({
      id: 'footer-1',
    });
  });

  it('answers null for a block that is gone, or no id', () => {
    const viewModel = fakeViewModel({ blocks: [{ id: 'main-1' }] });

    expect(findBlockById(viewModel, 'gone')).toBeNull();
    expect(findBlockById(viewModel, null)).toBeNull();
  });
});
