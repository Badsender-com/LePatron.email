'use strict';

// PUT /mailings/:mailingId/mosaico stores a composed block's markup as the
// shared generator makes it from the block's state — not as the request sends
// it — and judges the template flag on what it will store.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: { findOne: jest.fn(), findOneForMosaico: jest.fn() },
  Templates: { findById: jest.fn() },
  Galleries: {},
  Users: {},
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  assertUserCanEditMailing: jest.fn(),
  previewMail: jest.fn(),
}));
jest.mock(
  '../../../packages/server/mailing/send-test-mail.controller.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/mailing/download-zip.controller.js',
  () => ({})
);
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  Mailings,
  Templates,
} = require('../../../packages/server/common/models.common.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const controller = require('../../../packages/server/mailing/mailing.controller.js');
const {
  generate,
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  serialiseState,
  parseState,
} = require('../../../packages/shared/block-builder/state.js');

const MAILING_ID = '507f1f77bcf86cd799439001';
const TEMPLATE_ID = '507f1f77bcf86cd799439002';
const user = {
  id: 'user-1',
  isAdmin: false,
  lang: 'fr',
  group: { id: '507f1f77bcf86cd799439003' },
};

const builderState = serialiseState({
  ...emptyState(),
  elements: [{ id: 'el-1', type: 'text', content: 'Bonjour' }],
});
const generated = generate(parseState(builderState));

const composed = (builderHtml, state = builderState) => ({
  type: 'blockBuilderBlock',
  builderHtml,
  builderState: state,
});
const dataWith = (...blocks) => ({ mainBlocks: { blocks } });

function mockMailing(storedData) {
  const mailing = {
    _id: MAILING_ID,
    _wireframe: TEMPLATE_ID,
    data: storedData,
    save: jest.fn().mockResolvedValue(undefined),
    markModified: jest.fn(),
  };
  Mailings.findOne.mockResolvedValue(mailing);
  return mailing;
}

function mockFlags(flags) {
  Templates.findById.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(flags) }),
  });
}

// Resolves with the error passed to `next`, or null when the request succeeded.
function save(body) {
  return new Promise((resolve) => {
    const res = { json: () => resolve(null) };
    controller.updateMosaico(
      { params: { mailingId: MAILING_ID }, body, user },
      res,
      resolve
    );
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  mailingService.assertUserCanEditMailing.mockResolvedValue(undefined);
  Mailings.findOneForMosaico.mockResolvedValue({});
});

describe('PUT /mailings/:mailingId/mosaico — composed markup', () => {
  it('stores the markup the state generates, not the one sent', async () => {
    const mailing = mockMailing(dataWith());
    mockFlags({ blockBuilderEnabled: true });

    expect(
      await save({ data: dataWith(composed('<p>autre chose</p>')) })
    ).toBeNull();
    expect(mailing.data.mainBlocks.blocks[0].builderHtml).toBe(generated);
  });

  it('keeps a stored block as it is, whatever generated it', async () => {
    const stored = composed('<table><tr><td>ancien</td></tr></table>');
    const mailing = mockMailing(dataWith(stored));
    mockFlags({ blockBuilderEnabled: true });

    await save({ data: dataWith({ ...stored }) });

    expect(mailing.data.mainBlocks.blocks[0].builderHtml).toBe(
      stored.builderHtml
    );
  });

  // With the flag off, stored blocks stay savable — but a new state behind the
  // stored markup is a new block, and is judged on what it rebuilds to.
  it('refuses a changed state behind stored markup, flag off', async () => {
    const stored = composed(generated);
    const mailing = mockMailing(dataWith(stored));
    mockFlags({ blockBuilderEnabled: false });
    const otherState = serialiseState({
      ...emptyState(),
      elements: [{ id: 'el-1', type: 'text', content: 'Bonsoir' }],
    });

    expect(
      await save({ data: dataWith(composed(generated, otherState)) })
    ).toMatchObject({ message: 'BLOCK_BUILDER_DISABLED' });
    expect(mailing.save).not.toHaveBeenCalled();
  });

  it('still saves the stored block untouched, flag off', async () => {
    const stored = composed(generated);
    mockMailing(dataWith(stored));
    mockFlags({ blockBuilderEnabled: false });

    expect(await save({ data: dataWith({ ...stored }) })).toBeNull();
  });
});
