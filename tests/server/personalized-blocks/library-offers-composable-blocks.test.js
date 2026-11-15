'use strict';

// The saved-block list offers no composed block the email save would refuse
// (ADR 0027): none while the template's Block Builder is off, none to a user
// who may not compose. Saved template blocks are always offered, and nothing
// is deleted — turning the Block Builder back on brings the composed blocks
// back.
//
// Before this, a saved composed block stayed listed and insertable under a
// template whose Block Builder was off, and the email save refused it
// afterwards: the whole save, after the user had worked.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Templates: { findById: jest.fn() },
  PersonalizedBlocks: {},
  Users: { collection: { name: 'users' } },
}));
jest.mock(
  '../../../packages/server/personalized-blocks/personalized-block-service.js',
  () => ({ getPersonalizedBlocks: jest.fn() })
);

const {
  Templates,
} = require('../../../packages/server/common/models.common.js');
const personalizedBlockService = require('../../../packages/server/personalized-blocks/personalized-block-service.js');
const { ROLES } = require('../../../packages/shared/access/roles.js');

const GROUP = '507f1f77bcf86cd799439001';
const TEMPLATE = '507f1f77bcf86cd799439002';

const entry = (name, type) => ({
  _id: `id-${name}`,
  name,
  category: 'Divers',
  content: { type, id: '' },
});

const TEMPLATE_ENTRY = entry('Bandeau', 'heroBlock');
const COMPOSED_ENTRY = entry('Deux colonnes', 'blockBuilderBlock');
const HTML_CODE_ENTRY = entry('Code collé', 'htmlCodeBlock');

const flagsAre = (flags) =>
  Templates.findById.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(flags) }),
  });

async function list({ role = ROLES.REGULAR_USER } = {}) {
  // Required here: the controller is only touched by #1564 to read the flag
  // and the user, and its module graph must load under the mocks above.
  const controller = require('../../../packages/server/personalized-blocks/personalized-block-controller.js');
  const res = { json: jest.fn() };
  const next = jest.fn();
  await controller.listPersonalizedBlocks(
    {
      query: { groupId: GROUP, templateId: TEMPLATE },
      user: { id: 'user-1', role, group: { id: GROUP } },
    },
    res,
    next
  );
  expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  return res.json.mock.calls[0][0].items.map((item) => item.name);
}

beforeEach(() => {
  jest.clearAllMocks();
  personalizedBlockService.getPersonalizedBlocks.mockResolvedValue([
    TEMPLATE_ENTRY,
    COMPOSED_ENTRY,
    HTML_CODE_ENTRY,
  ]);
});

describe('the library offers no composed block it would refuse', () => {
  it('offers every entry while the Block Builder is on', async () => {
    flagsAre({ blockBuilderEnabled: true, htmlBlockEnabled: true });

    expect(await list()).toEqual(['Bandeau', 'Deux colonnes', 'Code collé']);
  });

  it('offers no composed block while the Block Builder is off', async () => {
    flagsAre({ blockBuilderEnabled: false, htmlBlockEnabled: true });

    expect(await list()).toEqual(['Bandeau', 'Code collé']);
  });

  it('offers no composed block to a user who may not compose', async () => {
    flagsAre({ blockBuilderEnabled: true, htmlBlockEnabled: true });

    expect(await list({ role: ROLES.WRITER })).toEqual([
      'Bandeau',
      'Code collé',
    ]);
  });

  it('reads a template it cannot find as offering no composed block', async () => {
    flagsAre(null);

    expect(await list()).not.toContain('Deux colonnes');
  });

  it('keeps the order the library gives', async () => {
    personalizedBlockService.getPersonalizedBlocks.mockResolvedValue([
      COMPOSED_ENTRY,
      TEMPLATE_ENTRY,
    ]);
    flagsAre({ blockBuilderEnabled: true });

    expect(await list()).toEqual(['Deux colonnes', 'Bandeau']);
  });
});
