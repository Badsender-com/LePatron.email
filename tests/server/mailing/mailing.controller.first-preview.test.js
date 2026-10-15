'use strict';

// PUT /mailings/:mailingId/preview: the editor stores the first rendering of
// an email that has none, for whoever opens it, a reviewer included. Only the
// preview is written, and only while there is none: the route changes nothing
// else of the email, so it gives no way around the save's capability.

const {
  Mailings,
  controller,
  mailingService,
  mockMailing,
  resetMocks,
  user,
  MAILING_ID,
} = require('./update-mosaico.harness.js');
const {
  PREVIEW_HTML_MAX_LENGTH,
} = require('../../../packages/server/utils/preview-html-sanitizer.js');

const reviewer = { ...user, role: 'reviewer' };

// Resolves with the status sent, or the error passed to `next`.
function storePreview(body, actor = reviewer) {
  return new Promise((resolve) => {
    const res = { status: (status) => ({ send: () => resolve({ status }) }) };
    controller.storeFirstPreview(
      { params: { mailingId: MAILING_ID }, body, user: actor },
      res,
      resolve
    );
  });
}

beforeEach(() => {
  resetMocks();
  Mailings.updateOne.mockResolvedValue({ nModified: 1 });
});

describe('PUT /mailings/:mailingId/preview', () => {
  it('writes the preview, and nothing else, while there is none', async () => {
    const mailing = mockMailing({ heading: 'kept' }, '');

    expect(await storePreview({ html: '<p>an email</p>' })).toEqual({
      status: 204,
    });
    expect(Mailings.updateOne).toHaveBeenCalledWith(
      { _id: MAILING_ID, previewHtml: { $in: [null, ''] } },
      { $set: { previewHtml: '<p>an email</p>' } }
    );
    expect(mailing.save).not.toHaveBeenCalled();
  });

  it('checks the access to the email first', async () => {
    mockMailing({}, '');
    mailingService.assertUserCanEditMailing.mockRejectedValue(
      Object.assign(new Error('FORBIDDEN_RESOURCE_OR_ACTION'), { status: 403 })
    );

    expect(await storePreview({ html: '<p>x</p>' })).toMatchObject({
      status: 403,
    });
    expect(Mailings.updateOne).not.toHaveBeenCalled();
  });

  it('answers an email of another company as one that does not exist', async () => {
    Mailings.findOne.mockResolvedValue(null);

    expect(await storePreview({ html: '<p>x</p>' })).toMatchObject({
      status: 404,
      message: 'MAILING_NOT_FOUND',
    });
  });

  it.each([
    ['no rendering', {}],
    ['an empty one', { html: '  ' }],
    ['something else than text', { html: { $ne: '' } }],
  ])('refuses %s', async (_label, body) => {
    mockMailing({}, '');

    expect(await storePreview(body)).toMatchObject({
      status: 400,
      message: 'PREVIEW_HTML_REQUIRED',
    });
    expect(Mailings.updateOne).not.toHaveBeenCalled();
  });

  it('refuses a rendering past the size the preview keeps', async () => {
    mockMailing({}, '');

    expect(
      await storePreview({ html: 'x'.repeat(PREVIEW_HTML_MAX_LENGTH + 1) })
    ).toMatchObject({ status: 400, message: 'PREVIEW_HTML_TOO_LARGE' });
  });
});
