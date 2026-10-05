'use strict';

// The one sequence every write of synthetic content goes through — the mailing
// save and the personalized blocks. What is pinned here is the order: sizes
// before the rebuild, sizes again after it, the flags last and only when there
// is something to judge.

jest.mock('../../../packages/server/mailing/builder-block-integrity.js', () => {
  const actual = jest.requireActual(
    '../../../packages/server/mailing/builder-block-integrity.js'
  );
  return { rebuildComposedMarkup: jest.fn(actual.rebuildComposedMarkup) };
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

const stateWith = (content) => {
  const state = {
    ...emptyState(),
    elements: [{ id: 'el-1', type: 'text', content }],
  };
  return { serialised: serialiseState(state), html: generate(state) };
};

const run = (data, previousData, flags = { blockBuilderEnabled: true }) => {
  const loadFlags = jest.fn(async () => flags);
  return {
    loadFlags,
    done: normalizeAndGuardSyntheticContent({ data, previousData, loadFlags }),
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
    expect(loadFlags).not.toHaveBeenCalled();
  });

  it('rebuilds a composed block, then lets it through its flag', async () => {
    const { serialised, html } = stateWith('Bonjour');
    const block = builderBlock('<p>sent</p>', serialised);
    const { loadFlags, done } = run(dataWith(block));

    await done;

    expect(block.builderHtml).toBe(html);
    expect(loadFlags).toHaveBeenCalledTimes(1);
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
