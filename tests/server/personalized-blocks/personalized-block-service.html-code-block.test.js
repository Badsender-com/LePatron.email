'use strict';

// A personalized block is shared with the whole company and dropped into other
// people's mailings. Saving one is a second way to write an HTML code block, so
// it gets the same gate as the mailing save: the flag of the block's template.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  PersonalizedBlocks: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  Users: {},
  Templates: { findById: jest.fn() },
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

const htmlBlock = (htmlCode) => ({ type: 'htmlCodeBlock', htmlCode });
const lean = (value) => ({
  select: () => ({ lean: () => Promise.resolve(value) }),
});

beforeEach(() => {
  jest.resetAllMocks();
  PersonalizedBlocks.create.mockImplementation(async (doc) => doc);
  PersonalizedBlocks.findByIdAndUpdate.mockImplementation(
    async (id, doc) => doc
  );
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
    PersonalizedBlocks.findById.mockReturnValue(
      lean({ content: htmlBlock('<p>stored</p>'), _template: TEMPLATE })
    );
    Templates.findById.mockReturnValue(lean({ htmlBlockEnabled: false }));

    await expect(
      service.updatePersonalizedBlock(BLOCK, GROUP, {
        content: htmlBlock('<p>changed</p>'),
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(Templates.findById).toHaveBeenCalledWith(TEMPLATE);
    expect(PersonalizedBlocks.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('keeps accepting a rename of a block whose markup is unchanged', async () => {
    PersonalizedBlocks.findById.mockReturnValue(
      lean({ content: htmlBlock('<p>stored</p>'), _template: TEMPLATE })
    );
    Templates.findById.mockReturnValue(lean({ htmlBlockEnabled: false }));

    await service.updatePersonalizedBlock(BLOCK, GROUP, {
      name: 'renamed',
      content: htmlBlock('<p>stored</p>'),
    });

    expect(PersonalizedBlocks.findByIdAndUpdate).toHaveBeenCalled();
  });
});
