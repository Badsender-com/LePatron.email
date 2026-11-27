'use strict';

// Saving a composed block to the library asks for `block.compose`, like the
// email save (ADR 0027). A composition put in the library is inserted by
// others: who may not compose may not bring one through the library either.
// Today every role that may save a block may also compose, so this only holds
// the line for the day the two capabilities part.

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
const controller = require('../../../packages/server/personalized-blocks/personalized-block-controller.js');
const { ROLES } = require('../../../packages/shared/access/roles.js');
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
const {
  builderBlock,
  htmlBlock,
} = require('../mailing/synthetic-blocks.fixtures.js');

const GROUP = '507f1f77bcf86cd799439001';
const TEMPLATE = '507f1f77bcf86cd799439002';
const USER = '507f1f77bcf86cd799439003';
const BLOCK = '507f1f77bcf86cd799439004';

const lean = (value) => ({
  select: () => ({ lean: () => Promise.resolve(value) }),
});

const composed = (content) => {
  const state = {
    ...emptyState(),
    rows: singleColumnRows([{ id: 'el-1', type: 'text', content }]),
  };
  return builderBlock(generate(state), serialiseState(state));
};

beforeEach(() => {
  jest.resetAllMocks();
  PersonalizedBlocks.create.mockImplementation(async (doc) => doc);
  PersonalizedBlocks.findOneAndUpdate.mockImplementation(
    async (filter, doc) => doc
  );
  Templates.findOne.mockReturnValue(lean({ _id: TEMPLATE }));
  Templates.findById.mockReturnValue(
    lean({ blockBuilderEnabled: true, htmlBlockEnabled: true })
  );
});

const add = (content, options) =>
  service.addPersonalizedBlock(
    { name: 'n', content },
    GROUP,
    TEMPLATE,
    USER,
    options
  );

describe('saving a composed block to the library', () => {
  it('saves it for someone who may compose', async () => {
    await add(composed('Bonjour'), { mayCompose: true });

    expect(PersonalizedBlocks.create).toHaveBeenCalledTimes(1);
  });

  it('refuses it to someone who may not compose', async () => {
    await expect(
      add(composed('Bonjour'), { mayCompose: false })
    ).rejects.toMatchObject({
      status: 403,
      message: 'BLOCK_BUILDER_NOT_PERMITTED',
    });
    expect(PersonalizedBlocks.create).not.toHaveBeenCalled();
  });

  it('refuses it when nothing says the author may compose', async () => {
    await expect(add(composed('Bonjour'))).rejects.toMatchObject({
      status: 403,
    });
  });

  it('keeps saving any other block for someone who may not compose', async () => {
    await add(htmlBlock('<p>collé</p>'), { mayCompose: false });

    expect(PersonalizedBlocks.create).toHaveBeenCalledTimes(1);
  });

  it('refuses a changed composition on update, and keeps a rename open', async () => {
    const stored = composed('Bonjour');
    PersonalizedBlocks.findOne.mockReturnValue(
      lean({ content: stored, _template: TEMPLATE })
    );

    await expect(
      service.updatePersonalizedBlock(
        BLOCK,
        GROUP,
        { content: composed('Au revoir') },
        { mayCompose: false }
      )
    ).rejects.toMatchObject({ status: 403 });

    await service.updatePersonalizedBlock(
      BLOCK,
      GROUP,
      { name: 'renommé', content: { ...stored } },
      { mayCompose: false }
    );
    expect(PersonalizedBlocks.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('the library routes pass the author’s right to compose', () => {
  // The route hands its error to `next`, as express-async-handler does.
  const create = async (role) => {
    const next = jest.fn();
    await controller.createPersonalizedBlock(
      {
        body: {
          groupId: GROUP,
          templateId: TEMPLATE,
          name: 'n',
          content: composed('Bonjour'),
        },
        user: { id: USER, role, group: { id: GROUP } },
      },
      { json: jest.fn() },
      next
    );
    return next.mock.calls.map(([error]) => error).find(Boolean);
  };

  it('lets a regular user save a composed block', async () => {
    expect(await create(ROLES.REGULAR_USER)).toBeUndefined();
    expect(PersonalizedBlocks.create).toHaveBeenCalledTimes(1);
  });

  it('refuses one to a writer', async () => {
    expect(await create(ROLES.WRITER)).toMatchObject({
      status: 403,
      message: 'BLOCK_BUILDER_NOT_PERMITTED',
    });
    expect(PersonalizedBlocks.create).not.toHaveBeenCalled();
  });
});
