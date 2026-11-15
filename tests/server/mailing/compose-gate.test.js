'use strict';

// The server's half of `block.compose` (ADR 0027). The editor only hides the
// Block Builder's entry points; a hand-written request could still bring a
// composition. The pipeline every email save goes through is where the
// template flag already holds, and where this holds too.
//
// What is judged is the same as for the flag: a composed block whose markup and
// state are already stored in the email passes, whoever saves. So moving,
// duplicating and deleting a composed block, and saving an email whose composed
// blocks nobody touched, stay open to anyone who may save the email.

const {
  normalizeAndGuardSyntheticContent,
} = require('../../../packages/server/mailing/synthetic-content-pipeline.js');
const {
  generate,
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  serialiseState,
} = require('../../../packages/shared/block-builder/state.js');
const {
  singleColumnRows,
} = require('../../../packages/shared/block-builder/composition.js');
const { builderBlock, dataWith } = require('./synthetic-blocks.fixtures.js');

const composed = (content) => {
  const state = {
    ...emptyState(),
    rows: singleColumnRows([{ id: 'el-1', type: 'text', content }]),
  };
  return builderBlock(generate(state), serialiseState(state));
};

const save = ({ data, previousData, mayCompose }) =>
  normalizeAndGuardSyntheticContent({
    data,
    previousData,
    loadFlags: async () => ({ blockBuilderEnabled: true }),
    mayCompose,
  });

describe('the server refuses a composition from whoever may not compose', () => {
  it('refuses a new composed block', async () => {
    await expect(
      save({ data: dataWith(composed('Bonjour')), mayCompose: false })
    ).rejects.toMatchObject({
      status: 403,
      message: 'BLOCK_BUILDER_NOT_PERMITTED',
    });
  });

  it('refuses a changed composed block', async () => {
    const before = dataWith(composed('Bonjour'));
    const after = dataWith(composed('Au revoir'));

    await expect(
      save({ data: after, previousData: before, mayCompose: false })
    ).rejects.toMatchObject({ message: 'BLOCK_BUILDER_NOT_PERMITTED' });
  });

  it('lets a composed block already stored in the email through', async () => {
    const block = composed('Bonjour');

    await expect(
      save({
        data: dataWith({ ...block }, { type: 'textBlock' }),
        previousData: dataWith({ ...block }),
        mayCompose: false,
      })
    ).resolves.toBeUndefined();
  });

  it('lets a stored composed block be duplicated', async () => {
    const block = composed('Bonjour');

    await expect(
      save({
        data: dataWith({ ...block }, { ...block }),
        previousData: dataWith({ ...block }),
        mayCompose: false,
      })
    ).resolves.toBeUndefined();
  });

  it('lets an emptied composed block through, as the flag does', async () => {
    await expect(
      save({ data: dataWith(builderBlock('', '')), mayCompose: false })
    ).resolves.toBeUndefined();
  });

  it('lets whoever may compose add a composed block', async () => {
    await expect(
      save({ data: dataWith(composed('Bonjour')), mayCompose: true })
    ).resolves.toBeUndefined();
  });

  // The flag is judged first: a template that does not allow the builder says
  // so, whoever is saving.
  it('names the disabled builder before the missing right', async () => {
    await expect(
      normalizeAndGuardSyntheticContent({
        data: dataWith(composed('Bonjour')),
        loadFlags: async () => ({ blockBuilderEnabled: false }),
        mayCompose: false,
      })
    ).rejects.toMatchObject({ message: 'BLOCK_BUILDER_DISABLED' });
  });
});
