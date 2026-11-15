'use strict';

// A block saved to the library from an email may itself have been inserted
// from the library: it carries the entry it came from (ADR 0027). Kept in the
// new entry, that origin would name an entry the new one is not, and every
// block inserted from it would be stamped twice over. The server drops it, on
// creation and on update, whatever the editor sends.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  PersonalizedBlocks: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  Users: { collection: { name: 'users' } },
  Templates: { findById: jest.fn(), findOne: jest.fn() },
}));
jest.mock('../../../packages/server/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  PersonalizedBlocks,
  Templates,
} = require('../../../packages/server/common/models.common.js');
const service = require('../../../packages/server/personalized-blocks/personalized-block-service.js');
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
const { builderBlock } = require('../mailing/synthetic-blocks.fixtures.js');

const GROUP = '507f1f77bcf86cd799439001';
const TEMPLATE = '507f1f77bcf86cd799439002';
const USER = '507f1f77bcf86cd799439003';
const BLOCK = '507f1f77bcf86cd799439004';
const ORIGIN_ENTRY = '6af8d97d5a86a79f311eaf47';

const lean = (value) => ({
  select: () => ({ lean: () => Promise.resolve(value) }),
});

const insertedFromTheLibrary = () => {
  const state = {
    ...emptyState(),
    rows: singleColumnRows([{ id: 'el-1', type: 'text', content: 'Bonjour' }]),
  };
  return {
    ...builderBlock(generate(state), serialiseState(state)),
    libraryOrigin: ORIGIN_ENTRY,
  };
};

beforeEach(() => {
  jest.resetAllMocks();
  PersonalizedBlocks.create.mockImplementation(async (doc) => doc);
  PersonalizedBlocks.findOneAndUpdate.mockImplementation(
    async (filter, doc) => doc
  );
  Templates.findOne.mockReturnValue(lean({ _id: TEMPLATE }));
  Templates.findById.mockReturnValue(lean({ blockBuilderEnabled: true }));
});

describe('a block saved to the library keeps no origin of its own', () => {
  it('drops it when the entry is created', async () => {
    await service.addPersonalizedBlock(
      { name: 'n', content: insertedFromTheLibrary() },
      GROUP,
      TEMPLATE,
      USER,
      { mayCompose: true }
    );

    const [[saved]] = PersonalizedBlocks.create.mock.calls;
    expect(saved.content).not.toHaveProperty('libraryOrigin');
    expect(saved.content.builderState).toBeTruthy();
  });

  it('drops it when the entry is updated', async () => {
    PersonalizedBlocks.findOne.mockReturnValue(
      lean({ content: insertedFromTheLibrary(), _template: TEMPLATE })
    );

    await service.updatePersonalizedBlock(
      BLOCK,
      GROUP,
      { content: insertedFromTheLibrary() },
      { mayCompose: true }
    );

    const [[, { $set }]] = PersonalizedBlocks.findOneAndUpdate.mock.calls;
    expect($set.content).not.toHaveProperty('libraryOrigin');
  });

  it('leaves a template block as it is', async () => {
    const content = { type: 'heroBlock', id: '', libraryOrigin: 'x' };

    await service.addPersonalizedBlock(
      { name: 'n', content },
      GROUP,
      TEMPLATE,
      USER
    );

    const [[saved]] = PersonalizedBlocks.create.mock.calls;
    expect(saved.content).toEqual(content);
  });
});
