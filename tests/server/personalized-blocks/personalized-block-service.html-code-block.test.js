'use strict';

// A personalized block is shared with the whole company and dropped into other
// people's mailings. Saving one is a second way to write an HTML code block, so
// it gets the same gate as the mailing save: the flag of the block's template.

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

const {
  htmlBlock,
  builderBlock,
} = require('../mailing/synthetic-blocks.fixtures.js');
const lean = (value) => ({
  select: () => ({ lean: () => Promise.resolve(value) }),
});

beforeEach(() => {
  jest.resetAllMocks();
  PersonalizedBlocks.create.mockImplementation(async (doc) => doc);
  PersonalizedBlocks.findOneAndUpdate.mockImplementation(
    async (filter, doc) => doc
  );
  // The template belongs to the group, unless a test says otherwise.
  Templates.findOne.mockReturnValue(lean({ _id: TEMPLATE }));
});

describe('personalized blocks — the HTML code block flag', () => {
  it('saves an HTML code block when its template enables it', async () => {
    Templates.findById.mockReturnValue(lean({ htmlBlockEnabled: true }));

    await service.addPersonalizedBlock(
      { name: 'n', content: htmlBlock('<p>x</p>') },
      GROUP,
      TEMPLATE,
      USER
    );

    expect(PersonalizedBlocks.create).toHaveBeenCalled();
  });

  it('refuses one when its template does not', async () => {
    Templates.findById.mockReturnValue(lean({ htmlBlockEnabled: false }));

    await expect(
      service.addPersonalizedBlock(
        { name: 'n', content: htmlBlock('<p>x</p>') },
        GROUP,
        TEMPLATE,
        USER
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(PersonalizedBlocks.create).not.toHaveBeenCalled();
  });

  it('does not load the template for any other block', async () => {
    await service.addPersonalizedBlock(
      { name: 'n', content: { type: 'textBlock' } },
      GROUP,
      TEMPLATE,
      USER
    );

    expect(Templates.findById).not.toHaveBeenCalled();
    expect(PersonalizedBlocks.create).toHaveBeenCalled();
  });

  it('refuses new markup on update, against the stored block template', async () => {
    PersonalizedBlocks.findOne.mockReturnValue(
      lean({ content: htmlBlock('<p>stored</p>'), _template: TEMPLATE })
    );
    Templates.findById.mockReturnValue(lean({ htmlBlockEnabled: false }));

    await expect(
      service.updatePersonalizedBlock(BLOCK, GROUP, {
        content: htmlBlock('<p>changed</p>'),
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(Templates.findById).toHaveBeenCalledWith(TEMPLATE);
    expect(PersonalizedBlocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('keeps accepting a rename of a block whose markup is unchanged', async () => {
    PersonalizedBlocks.findOne.mockReturnValue(
      lean({ content: htmlBlock('<p>stored</p>'), _template: TEMPLATE })
    );
    Templates.findById.mockReturnValue(lean({ htmlBlockEnabled: false }));

    await service.updatePersonalizedBlock(BLOCK, GROUP, {
      name: 'renamed',
      content: htmlBlock('<p>stored</p>'),
    });

    expect(PersonalizedBlocks.findOneAndUpdate).toHaveBeenCalled();
  });
});

describe('personalized blocks — sizes and composed markup', () => {
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

  it('refuses an oversized HTML code block before loading anything', async () => {
    await expect(
      service.addPersonalizedBlock(
        { name: 'n', content: htmlBlock('x'.repeat(100001)) },
        GROUP,
        TEMPLATE,
        USER
      )
    ).rejects.toMatchObject({
      status: 400,
      message: 'HTML_CODE_BLOCK_TOO_LARGE',
    });
    expect(Templates.findById).not.toHaveBeenCalled();
    expect(PersonalizedBlocks.create).not.toHaveBeenCalled();
  });

  it('refuses an oversized composed state', async () => {
    const content = builderBlock('', 'x'.repeat(200001));

    await expect(
      service.addPersonalizedBlock(
        { name: 'n', content },
        GROUP,
        TEMPLATE,
        USER
      )
    ).rejects.toMatchObject({
      status: 400,
      message: 'BLOCK_BUILDER_TOO_LARGE',
    });
  });

  it('stores the markup the state generates, not the one sent', async () => {
    Templates.findById.mockReturnValue(lean({ blockBuilderEnabled: true }));
    const content = builderBlock('<p>autre chose</p>', builderState);

    await service.addPersonalizedBlock(
      { name: 'n', content },
      GROUP,
      TEMPLATE,
      USER
    );

    const [[saved]] = PersonalizedBlocks.create.mock.calls;
    expect(saved.content.builderHtml).toBe(generate(parseState(builderState)));
  });
});
