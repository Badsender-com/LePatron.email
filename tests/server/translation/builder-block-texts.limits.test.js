'use strict';

// Writing a composed block's translation back, at the edges: a block written
// by another generator version, and a translation the block cannot hold.

const {
  injectBuilderTexts,
} = require('../../../packages/server/translation/builder-block-texts.js');
const {
  composedBlock,
  text,
  modelWith,
} = require('./composed-block.fixtures.js');

// The stored markup is frozen when written; a block applied with another
// generator version renders differently today. It is still translated — the
// rebuild follows the current generator — but it is counted, so the user can
// be told to check it.
describe('a block written by another generator version', () => {
  const stale = () => ({
    ...composedBlock([text('Bonjour')]),
    builderHtml: '<table><tr><td>Bonjour (older generator)</td></tr></table>',
  });

  it('is counted', () => {
    const data = modelWith(stale(), composedBlock([text('Salut')]));

    const result = injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'Hello',
      'builderBlock.mainBlocks.1.0.content': 'Hi',
    });

    expect(result.outdated).toBe(1);
  });

  it('is translated all the same, with the current generator', () => {
    const data = modelWith(stale());

    const result = injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'Hello',
    });

    expect(result.blocksUpdated).toBe(1);
    expect(data.mainBlocks.blocks[0].builderHtml).toBe(
      composedBlock([text('Hello')]).builderHtml
    );
  });

  it('is not suspected when the stored markup is what the generator makes', () => {
    const data = modelWith(composedBlock([text('Bonjour')]));

    expect(
      injectBuilderTexts(data, {
        'builderBlock.mainBlocks.0.0.content': 'Hello',
      }).outdated
    ).toBe(0);
  });
});

describe('a translation that would blow past the size limit', () => {
  const {
    HTML_CODE_MAX_LENGTH,
  } = require('../../../packages/server/mailing/synthetic-block-guard.js');

  // The save route enforces this limit, and it never sees this write: the
  // translated copy is persisted by `duplicateWithTranslatedData`. The value
  // now comes from a provider's response rather than something a user typed,
  // and `previewHtml` keeps a second copy in the same document, against
  // Mongo's 16MB ceiling.
  it('leaves the block exactly as it was', () => {
    const data = modelWith(composedBlock([text('Bonjour')]));
    const before = { ...data.mainBlocks.blocks[0] };

    const result = injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'x'.repeat(
        HTML_CODE_MAX_LENGTH + 1
      ),
    });

    expect(result.oversized).toBe(1);
    expect(result.blocksUpdated).toBe(0);
    expect(data.mainBlocks.blocks[0].builderHtml).toBe(before.builderHtml);
    expect(data.mainBlocks.blocks[0].builderState).toBe(before.builderState);
  });

  // Refusing rather than truncating: a block left in the source language is
  // visible and recoverable, half a table is not.
  it('never writes a truncated block', () => {
    const data = modelWith(composedBlock([text('Bonjour')]));

    injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'x'.repeat(
        HTML_CODE_MAX_LENGTH + 1
      ),
    });

    expect(data.mainBlocks.blocks[0].builderHtml.length).toBeLessThan(
      HTML_CODE_MAX_LENGTH
    );
  });

  // One bad block must not cost the whole mailing its translation.
  it('translates the other blocks all the same', () => {
    const data = modelWith(
      composedBlock([text('Trop long')]),
      composedBlock([text('Raisonnable')])
    );

    const result = injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'x'.repeat(
        HTML_CODE_MAX_LENGTH + 1
      ),
      'builderBlock.mainBlocks.1.0.content': 'Reasonable',
    });

    expect(result.oversized).toBe(1);
    expect(result.blocksUpdated).toBe(1);
    expect(data.mainBlocks.blocks[1].builderHtml).toContain('Reasonable');
  });

  it('accepts a translation that stays under the limit', () => {
    const data = modelWith(composedBlock([text('Bonjour')]));

    const result = injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'x'.repeat(1000),
    });

    expect(result.oversized).toBe(0);
    expect(result.blocksUpdated).toBe(1);
  });
});
