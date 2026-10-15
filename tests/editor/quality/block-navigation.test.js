/**
 * @jest-environment jsdom
 */

'use strict';

const {
  findBlockById,
  goToBlock,
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

describe('goToBlock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Element.prototype.scrollIntoView = jest.fn();
    document.body.innerHTML = '<div class="editable" data-block-id="b1"></div>';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('selects the block, then scrolls to it and hands it over', () => {
    const viewModel = fakeViewModel({ blocks: [{ id: 'b1' }] });
    viewModel.selectBlock = jest.fn();
    const onScrolled = jest.fn();
    const onMissing = jest.fn();

    expect(goToBlock(viewModel, 'b1', onScrolled, onMissing)).toBe(true);
    expect(viewModel.selectBlock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1' }),
      true
    );
    expect(onScrolled).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    const element = document.querySelector('[data-block-id="b1"]');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(onScrolled).toHaveBeenCalledWith(element);
    expect(onMissing).not.toHaveBeenCalled();
  });

  it('answers false, and selects nothing, for a block that is gone', () => {
    const viewModel = fakeViewModel({ blocks: [{ id: 'b1' }] });
    viewModel.selectBlock = jest.fn();

    expect(goToBlock(viewModel, 'gone', jest.fn())).toBe(false);
    expect(viewModel.selectBlock).not.toHaveBeenCalled();
  });

  it('says so when the block has no element on the canvas once selected', () => {
    document.body.innerHTML = '';
    const viewModel = fakeViewModel({ blocks: [{ id: 'b1' }] });
    viewModel.selectBlock = jest.fn();
    const onScrolled = jest.fn();
    const onMissing = jest.fn();

    expect(goToBlock(viewModel, 'b1', onScrolled, onMissing)).toBe(true);
    jest.advanceTimersByTime(100);
    expect(onScrolled).not.toHaveBeenCalled();
    expect(onMissing).toHaveBeenCalled();
  });
});
