'use strict';

// A personalized block belongs to a group. The routes check that the caller
// belongs to the group named in the request; the service is what ties the
// block itself to that same group — for reading it back, changing it and
// deleting it — and what keeps its group, template and author out of reach of
// the request.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  PersonalizedBlocks: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  },
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
const OTHER = '507f1f77bcf86cd799439009';

const lean = (value) => ({
  select: () => ({ lean: () => Promise.resolve(value) }),
});

// The filter a query was given, with ObjectIds as strings.
const filterOf = (mock) => {
  const [[filter]] = mock.mock.calls;
  return Object.fromEntries(
    Object.entries(filter).map(([key, value]) => [key, String(value)])
  );
};

beforeEach(() => {
  jest.resetAllMocks();
  PersonalizedBlocks.create.mockImplementation(async (doc) => doc);
  PersonalizedBlocks.findOneAndUpdate.mockImplementation(
    async (filter, update) => update
  );
  PersonalizedBlocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
  Templates.findOne.mockReturnValue(lean({ _id: TEMPLATE }));
});

describe('creating a block', () => {
  it('checks the template belongs to the group', async () => {
    await service.addPersonalizedBlock(
      { name: 'n', content: { type: 'textBlock' } },
      GROUP,
      TEMPLATE,
      USER
    );

    expect(filterOf(Templates.findOne)).toEqual({
      _id: TEMPLATE,
      _company: GROUP,
    });
    expect(PersonalizedBlocks.create).toHaveBeenCalled();
  });

  it('refuses a template of another group', async () => {
    Templates.findOne.mockReturnValue(lean(null));

    await expect(
      service.addPersonalizedBlock(
        { name: 'n', content: { type: 'textBlock' } },
        GROUP,
        OTHER,
        USER
      )
    ).rejects.toMatchObject({ status: 404 });
    expect(PersonalizedBlocks.create).not.toHaveBeenCalled();
  });
});

describe('updating a block', () => {
  it('finds the block within the group only', async () => {
    await service.updatePersonalizedBlock(BLOCK, GROUP, { name: 'renamed' });

    expect(filterOf(PersonalizedBlocks.findOneAndUpdate)).toEqual({
      _id: BLOCK,
      _group: GROUP,
    });
  });

  it('answers not found for a block of another group', async () => {
    PersonalizedBlocks.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      service.updatePersonalizedBlock(BLOCK, GROUP, { name: 'renamed' })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('changes only the name, the category and the content', async () => {
    await service.updatePersonalizedBlock(BLOCK, GROUP, {
      name: 'renamed',
      category: 'c',
      _group: OTHER,
      _template: OTHER,
      _user: OTHER,
      createdAt: 'x',
    });

    const [[, update]] = PersonalizedBlocks.findOneAndUpdate.mock.calls;
    expect(update).toEqual({ $set: { name: 'renamed', category: 'c' } });
  });

  it('reads the stored block within the group too', async () => {
    PersonalizedBlocks.findOne.mockReturnValue(lean(null));

    await expect(
      service.updatePersonalizedBlock(BLOCK, GROUP, {
        content: { type: 'htmlCodeBlock', htmlCode: '<p>x</p>' },
      })
    ).rejects.toMatchObject({ status: 404 });
    expect(filterOf(PersonalizedBlocks.findOne)).toEqual({
      _id: BLOCK,
      _group: GROUP,
    });
  });
});

describe('deleting a block', () => {
  it('deletes within the group only', async () => {
    await service.deletePersonalizedBlock(BLOCK, GROUP);

    expect(filterOf(PersonalizedBlocks.deleteOne)).toEqual({
      _id: BLOCK,
      _group: GROUP,
    });
  });

  it('answers not found for a block of another group', async () => {
    PersonalizedBlocks.deleteOne.mockResolvedValue({ deletedCount: 0 });

    await expect(
      service.deletePersonalizedBlock(BLOCK, GROUP)
    ).rejects.toMatchObject({ status: 404 });
  });
});
