'use strict';

// The list of saved blocks prints each block's author name, and the search
// reads it. The join projects that name.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  PersonalizedBlocks: { aggregate: jest.fn() },
  Users: { collection: { name: 'users' } },
  Templates: {},
}));
jest.mock('../../../packages/server/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  PersonalizedBlocks,
} = require('../../../packages/server/common/models.common.js');
const service = require('../../../packages/server/personalized-blocks/personalized-block-service.js');

const GROUP = '507f1f77bcf86cd799439001';
const TEMPLATE = '507f1f77bcf86cd799439002';

const authorJoin = async (searchTerm) => {
  PersonalizedBlocks.aggregate.mockResolvedValue([]);
  await service.getPersonalizedBlocks(GROUP, TEMPLATE, searchTerm);
  const [[pipeline]] = PersonalizedBlocks.aggregate.mock.calls;
  return pipeline.find((stage) => stage.$lookup).$lookup;
};

beforeEach(() => jest.resetAllMocks());

describe('the author of a saved block, in the list', () => {
  it('is joined from the users collection on the block author', async () => {
    const join = await authorJoin();

    expect(join.from).toBe('users');
    expect(join.as).toBe('userDetails');
    expect(join.let).toEqual({ userId: '$_user' });
    expect(join.pipeline[0]).toEqual({
      $match: { $expr: { $eq: ['$_id', '$$userId'] } },
    });
  });

  it('keeps the name only', async () => {
    const join = await authorJoin();
    const projections = join.pipeline.filter((stage) => stage.$project);

    expect(projections).toEqual([{ $project: { _id: 0, name: 1 } }]);
    expect(join.pipeline[join.pipeline.length - 1]).toEqual(projections[0]);
  });

  it('can still be searched by name', async () => {
    PersonalizedBlocks.aggregate.mockResolvedValue([]);
    await service.getPersonalizedBlocks(GROUP, TEMPLATE, 'Camille');
    const [[pipeline]] = PersonalizedBlocks.aggregate.mock.calls;

    expect(JSON.stringify(pipeline)).toContain('"userDetails.name"');
  });
});
