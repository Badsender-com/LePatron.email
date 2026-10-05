'use strict';

// PUT /mailings/:mailingId/mosaico stores a composed block's markup as the
// shared generator makes it from the block's state — not as the request sends
// it — and judges the template flag on what it will store.

const {
  mockMailing,
  mockFlags,
  save,
  resetMocks,
} = require('./update-mosaico.harness.js');
const { builderBlock, dataWith } = require('./synthetic-blocks.fixtures.js');
const {
  generate,
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  serialiseState,
  parseState,
} = require('../../../packages/shared/block-builder/state.js');

const builderState = serialiseState({
  ...emptyState(),
  elements: [{ id: 'el-1', type: 'text', content: 'Bonjour' }],
});
const generated = generate(parseState(builderState));

const composed = (builderHtml, state = builderState) =>
  builderBlock(builderHtml, state);

beforeEach(resetMocks);

describe('PUT /mailings/:mailingId/mosaico — composed markup', () => {
  it('stores the markup the state generates, not the one sent', async () => {
    const mailing = mockMailing(dataWith());
    mockFlags({ blockBuilderEnabled: true });

    expect(
      await save({ data: dataWith(composed('<p>autre chose</p>')) })
    ).toBeNull();
    expect(mailing.data.mainBlocks.blocks[0].builderHtml).toBe(generated);
  });

  it('keeps a stored block as it is, whatever generated it', async () => {
    const stored = composed('<table><tr><td>ancien</td></tr></table>');
    const mailing = mockMailing(dataWith(stored));
    mockFlags({ blockBuilderEnabled: true });

    await save({ data: dataWith({ ...stored }) });

    expect(mailing.data.mainBlocks.blocks[0].builderHtml).toBe(
      stored.builderHtml
    );
  });

  // With the flag off, stored blocks stay savable — but a new state behind the
  // stored markup is a new block, and is judged on what it rebuilds to.
  it('refuses a changed state behind stored markup, flag off', async () => {
    const stored = composed(generated);
    const mailing = mockMailing(dataWith(stored));
    mockFlags({ blockBuilderEnabled: false });
    const otherState = serialiseState({
      ...emptyState(),
      elements: [{ id: 'el-1', type: 'text', content: 'Bonsoir' }],
    });

    expect(
      await save({ data: dataWith(composed(generated, otherState)) })
    ).toMatchObject({ message: 'BLOCK_BUILDER_DISABLED' });
    expect(mailing.save).not.toHaveBeenCalled();
  });

  it('still saves the stored block untouched, flag off', async () => {
    const stored = composed(generated);
    mockMailing(dataWith(stored));
    mockFlags({ blockBuilderEnabled: false });

    expect(await save({ data: dataWith({ ...stored }) })).toBeNull();
  });
});
