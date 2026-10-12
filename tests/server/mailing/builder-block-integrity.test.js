'use strict';

// The export ships a composed block's markup, so that markup must be what the
// shared generator makes of the block's state. A pair already stored on the
// mailing is kept as is; any other pair has its markup rebuilt.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../../../packages/server/utils/logger.js');
const {
  rebuildComposedMarkup,
} = require('../../../packages/server/mailing/builder-block-integrity.js');
const {
  asModel,
} = require('../../../packages/server/mailing/synthetic-block-guard.js');
const {
  generate,
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  serialiseState,
  parseState,
} = require('../../../packages/shared/block-builder/state.js');

const stateWith = (content) =>
  serialiseState({
    ...emptyState(),
    elements: [{ id: 'el-1', type: 'text', content }],
  });

const composed = (builderState, builderHtml) => ({
  type: 'blockBuilderBlock',
  id: 'ko_blockBuilderBlock_1',
  builderState,
  builderHtml,
});

const modelOf = (...blocks) => ({ mainBlocks: { blocks } });

const generated = (builderState) => generate(parseState(builderState));

describe('rebuildComposedMarkup', () => {
  it('leaves a block whose markup is what its state generates', () => {
    const state = stateWith('Bonjour');
    const block = composed(state, generated(state));

    expect(rebuildComposedMarkup(modelOf(block))).toBe(0);
    expect(block.builderHtml).toBe(generated(state));
  });

  it('rebuilds a block whose markup is not what its state generates', () => {
    const state = stateWith('Bonjour');
    const block = composed(state, '<p>autre chose</p>');

    expect(rebuildComposedMarkup(modelOf(block))).toBe(1);
    expect(block.builderHtml).toBe(generated(state));
  });

  it('keeps a pair already stored on the mailing, byte for byte', () => {
    // Written by another generator version: still the validated email.
    const state = stateWith('Bonjour');
    const stored = composed(state, '<table><tr><td>ancien</td></tr></table>');
    const incoming = { ...stored };

    expect(rebuildComposedMarkup(modelOf(incoming), modelOf(stored))).toBe(0);
    expect(incoming.builderHtml).toBe(stored.builderHtml);
  });

  it('does not keep stored markup next to another state', () => {
    const stored = composed(
      stateWith('Bonjour'),
      generated(stateWith('Bonjour'))
    );
    const incoming = composed(stateWith('Bonsoir'), stored.builderHtml);

    rebuildComposedMarkup(modelOf(incoming), modelOf(stored));

    expect(incoming.builderHtml).toBe(generated(stateWith('Bonsoir')));
  });

  it('builds the markup of a block that brings a state and no markup', () => {
    const state = stateWith('Bonjour');
    const block = composed(state, '');

    rebuildComposedMarkup(modelOf(block));

    expect(block.builderHtml).toBe(generated(state));
  });

  it('walks every top-level container, not only mainBlocks', () => {
    const state = stateWith('Bonjour');
    const block = composed(state, '<p>x</p>');

    rebuildComposedMarkup({ footerBlocks: { blocks: [block] } });

    expect(block.builderHtml).toBe(generated(state));
  });

  it('takes a single block too, as a personalized block stores it', () => {
    const state = stateWith('Bonjour');
    const block = composed(state, '<p>x</p>');

    rebuildComposedMarkup(asModel(block));

    expect(block.builderHtml).toBe(generated(state));
  });

  it('leaves the other blocks alone', () => {
    const htmlBlock = { type: 'htmlCodeBlock', htmlCode: '<p>collé</p>' };
    const text = { type: 'textBlock', text: 'Bonjour' };

    expect(rebuildComposedMarkup(modelOf(htmlBlock, text))).toBe(0);
    expect(htmlBlock.htmlCode).toBe('<p>collé</p>');
  });

  it('accepts what is not a content model', () => {
    expect(rebuildComposedMarkup(null)).toBe(0);
    expect(rebuildComposedMarkup('x')).toBe(0);
  });
});

// Rebuilt into nothing, an unreadable block would be saved empty by the next
// autosave and its composition lost for good: it is refused instead.
describe('rebuildComposedMarkup — a state it cannot read', () => {
  beforeEach(() => jest.clearAllMocks());

  const refusal = (block, stored) => {
    try {
      rebuildComposedMarkup(modelOf(block), stored && modelOf(stored));
    } catch (error) {
      return error;
    }
    return null;
  };

  it.each([
    ['corrupt JSON', '{"v":1,"elements":[', '<p>markup</p>'],
    [
      'a state from a future version',
      JSON.stringify({ v: 99, elements: [{ id: 'e', type: 'text' }] }),
      '<p>markup</p>',
    ],
    ['a state of another shape', JSON.stringify({ v: 1 }), ''],
    ['markup without any state', '', '<p>markup</p>'],
  ])('refuses %s, and leaves the block as it was', (_label, state, html) => {
    const block = composed(state, html);

    expect(refusal(block)).toMatchObject({
      status: 400,
      message: 'BLOCK_BUILDER_STATE_UNREADABLE',
    });
    expect(block.builderHtml).toBe(html);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('accepts a block holding nothing at all', () => {
    const block = composed('', '');

    expect(refusal(block)).toBeNull();
    expect(block.builderHtml).toBe('');
  });

  // What the editor stores when every element was removed, then applied.
  it('accepts a composition without any element, as an empty block', () => {
    const block = composed(serialiseState(emptyState()), '<p>stale</p>');

    expect(refusal(block)).toBeNull();
    expect(block.builderHtml).toBe('');
  });

  // Stored before this rule, or by a newer version: still the author's email.
  it('keeps an unreadable pair already stored on the mailing', () => {
    const stored = composed('not json', '<p>markup</p>');

    expect(refusal({ ...stored }, stored)).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
