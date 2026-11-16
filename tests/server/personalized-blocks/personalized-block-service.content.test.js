'use strict';

// A saved block's content is the block alone: the palette builds its
// `blockInformation` from the list entry, so the content is stored without one.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  PersonalizedBlocks: { create: jest.fn(), findOneAndUpdate: jest.fn() },
  Users: {},
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

const GROUP = '507f1f77bcf86cd799439001';
const TEMPLATE = '507f1f77bcf86cd799439002';
const USER = '507f1f77bcf86cd799439003';
const BLOCK = '507f1f77bcf86cd799439004';

const content = () => ({
  type: 'footerBlock',
  text: 'Unsubscribe',
  blockInformation: { _id: BLOCK, name: 'Footer', userDetails: { name: 'C' } },
});

beforeEach(() => {
  jest.resetAllMocks();
  PersonalizedBlocks.create.mockImplementation(async (doc) => doc);
  PersonalizedBlocks.findOneAndUpdate.mockImplementation(
    async (filter, doc) => doc
  );
  Templates.findOne.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ _id: TEMPLATE }) }),
  });
});

describe('the content of a saved block', () => {
  it('is stored without a blockInformation when the block is created', async () => {
    await service.addPersonalizedBlock(
      { name: 'Footer', category: 'Legal', content: content() },
      GROUP,
      TEMPLATE,
      USER
    );

    const [[stored]] = PersonalizedBlocks.create.mock.calls;
    expect(stored.content).toEqual({
      type: 'footerBlock',
      text: 'Unsubscribe',
    });
    expect(stored.name).toBe('Footer');
  });

  it('is stored without a blockInformation when the block is changed', async () => {
    await service.updatePersonalizedBlock(BLOCK, GROUP, { content: content() });

    const [[, { $set }]] = PersonalizedBlocks.findOneAndUpdate.mock.calls;
    expect($set.content).toEqual({ type: 'footerBlock', text: 'Unsubscribe' });
  });

  it('is left out of a change that does not send one', async () => {
    await service.updatePersonalizedBlock(BLOCK, GROUP, { name: 'Footer 2' });

    const [[, { $set }]] = PersonalizedBlocks.findOneAndUpdate.mock.calls;
    expect($set).toEqual({ name: 'Footer 2' });
  });
});
