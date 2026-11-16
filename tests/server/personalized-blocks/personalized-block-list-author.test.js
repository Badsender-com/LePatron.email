'use strict';

// The list of saved blocks prints each block's author name, and the search
// reads it. The join returns that name and nothing else.

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

const listPipeline = async (searchTerm) => {
  PersonalizedBlocks.aggregate.mockResolvedValue([]);
  await service.getPersonalizedBlocks(GROUP, TEMPLATE, searchTerm);
  const [[pipeline]] = PersonalizedBlocks.aggregate.mock.calls;
  return pipeline;
};

const authorJoin = (pipeline) =>
  pipeline.find((stage) => stage.$lookup).$lookup;

beforeEach(() => jest.resetAllMocks());

describe('the author of a saved block, in the list', () => {
  it('keeps the name only', async () => {
    const join = authorJoin(await listPipeline());
    const lastStage = join.pipeline[join.pipeline.length - 1];

    expect(lastStage).toEqual({ $project: { _id: 0, name: 1 } });
  });

  it('can still be searched by name', async () => {
    const pipeline = await listPipeline('Camille');
    const { as } = authorJoin(pipeline);
    const searchesOnAuthor = pipeline.some((stage) =>
      (stage.$match?.$or || []).some(
        (clause) => clause[`${as}.name`]?.$regex === 'Camille'
      )
    );

    expect(searchesOnAuthor).toBe(true);
  });
});
