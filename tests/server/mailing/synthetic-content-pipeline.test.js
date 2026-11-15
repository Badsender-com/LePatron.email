'use strict';

// The one sequence every write of synthetic content goes through — the mailing
// save and the personalized blocks. What is pinned here is the order: sizes
// before the rebuild, the builder flag before it too, sizes again after it, and
// the flags loaded only when there is something to judge.

jest.mock('../../../packages/server/mailing/builder-block-integrity.js', () => {
  const actual = jest.requireActual(
    '../../../packages/server/mailing/builder-block-integrity.js'
  );
  return {
    rebuildComposedMarkup: jest.fn(actual.rebuildComposedMarkup),
    assertComposedBlocksAllowed: jest.fn(actual.assertComposedBlocksAllowed),
  };
});

const {
  rebuildComposedMarkup,
} = require('../../../packages/server/mailing/builder-block-integrity.js');
const {
  normalizeAndGuardSyntheticContent,
} = require('../../../packages/server/mailing/synthetic-content-pipeline.js');
const {
  HTML_CODE_MAX_LENGTH,
  SYNTHETIC_CONTENT_MAX_LENGTH,
} = require('../../../packages/shared/synthetic-blocks.js');
const {
  generate,
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  serialiseState,
} = require('../../../packages/shared/block-builder/state.js');
const {
  htmlBlock,
  builderBlock,
  dataWith,
  longerThan,
} = require('./synthetic-blocks.fixtures.js');
const {
  singleColumnRows,
} = require('../../../packages/shared/block-builder/composition.js');

const stateWith = (content) => {
  const state = {
    ...emptyState(),
    rows: singleColumnRows([{ id: 'el-1', type: 'text', content }]),
  };
  return { serialised: serialiseState(state), html: generate(state) };
};

// By someone who may compose: the right to compose is pinned in
// compose-gate.test.js, and this file is about the order of the steps.
const run = (data, previousData, flags = { blockBuilderEnabled: true }) => {
  const loadFlags = jest.fn(async () => flags);
  return {
    loadFlags,
    done: normalizeAndGuardSyntheticContent({
      data,
      previousData,
      loadFlags,
      mayCompose: true,
    }),
  };
};

beforeEach(() => jest.clearAllMocks());

describe('normalizeAndGuardSyntheticContent', () => {
  it('loads no flags for content without any synthetic block', async () => {
    const { loadFlags, done } = run(dataWith({ type: 'textBlock' }));

    await done;

    expect(loadFlags).not.toHaveBeenCalled();
    expect(rebuildComposedMarkup).not.toHaveBeenCalled();
  });

  it('never rebuilds oversized input', async () => {
    const { loadFlags, done } = run(
      dataWith(builderBlock('<p>x</p>', longerThan(HTML_CODE_MAX_LENGTH * 2)))
    );

    await expect(done).rejects.toMatchObject({
      status: 400,
      message: 'BLOCK_BUILDER_TOO_LARGE',
    });
    expect(rebuildComposedMarkup).not.toHaveBeenCalled();
    expect(loadFlags).not.toHaveBeenCalled();
  });

  it('never rebuilds content past the bound on the sum', async () => {
    const { serialised } = stateWith('Bonjour');
    const full = 'x'.repeat(HTML_CODE_MAX_LENGTH);
    const count = Math.ceil(SYNTHETIC_CONTENT_MAX_LENGTH / full.length);
    const { done } = run(
      dataWith(
        builderBlock('', serialised),
        ...Array.from({ length: count }, () => htmlBlock(full))
      )
    );

    await expect(done).rejects.toMatchObject({
      status: 400,
      message: 'SYNTHETIC_CONTENT_TOO_LARGE',
    });
    expect(rebuildComposedMarkup).not.toHaveBeenCalled();
  });

  // A state within its own bound can still generate markup past the markup
  // bound: what is stored is what is measured.
  it('measures the rebuilt markup again', async () => {
    const { serialised } = stateWith('x'.repeat(HTML_CODE_MAX_LENGTH));
    const { loadFlags, done } = run(dataWith(builderBlock('', serialised)));

    await expect(done).rejects.toMatchObject({
      message: 'BLOCK_BUILDER_TOO_LARGE',
    });
    expect(rebuildComposedMarkup).toHaveBeenCalledTimes(1);
    expect(loadFlags).toHaveBeenCalledTimes(1);
  });

  it('rebuilds a composed block, then lets it through its flag', async () => {
    const { serialised, html } = stateWith('Bonjour');
    const block = builderBlock('<p>sent</p>', serialised);
    const { loadFlags, done } = run(dataWith(block));

    await done;

    expect(block.builderHtml).toBe(html);
    expect(loadFlags).toHaveBeenCalledTimes(1);
  });

  describe('on a template without the builder', () => {
    const disabled = { blockBuilderEnabled: false };

    it('refuses a new composed block before rebuilding anything', async () => {
      const { serialised } = stateWith('Bonjour');
      const { done } = run(
        dataWith(builderBlock('', serialised)),
        undefined,
        disabled
      );

      await expect(done).rejects.toMatchObject({
        status: 403,
        message: 'BLOCK_BUILDER_DISABLED',
      });
      expect(rebuildComposedMarkup).not.toHaveBeenCalled();
    });

    it('refuses an unreadable state as disabled, before reading it', async () => {
      const { done } = run(
        dataWith(builderBlock('<p>x</p>', '{"v":1,"elements":[')),
        undefined,
        disabled
      );

      await expect(done).rejects.toMatchObject({
        status: 403,
        message: 'BLOCK_BUILDER_DISABLED',
      });
      expect(rebuildComposedMarkup).not.toHaveBeenCalled();
    });

    it('keeps accepting a composed block already stored', async () => {
      const { serialised, html } = stateWith('Bonjour');
      const block = () => builderBlock(html, serialised);
      const { done } = run(dataWith(block()), dataWith(block()), disabled);

      await expect(done).resolves.toBeUndefined();
    });

    it('keeps accepting a block emptied in the editor', async () => {
      const block = builderBlock('<p>stale</p>', serialiseState(emptyState()));
      const { done } = run(dataWith(block), undefined, disabled);

      await expect(done).resolves.toBeUndefined();
      expect(block.builderHtml).toBe('');
    });
  });

  it('refuses a block its template does not allow', async () => {
    const { done } = run(dataWith(htmlBlock('<p>x</p>')), undefined, {
      blockBuilderEnabled: true,
    });

    await expect(done).rejects.toMatchObject({
      status: 403,
      message: 'HTML_CODE_BLOCK_DISABLED',
    });
  });

  it('reads a template it could not find as allowing nothing', async () => {
    const { done } = run(dataWith(htmlBlock('<p>x</p>')), undefined, null);

    await expect(done).rejects.toMatchObject({ status: 403 });
  });
});
