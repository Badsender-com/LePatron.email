'use strict';

// POST /mailings/:mailingId/duplicate puts the copy next to the original, in
// its workspace or folder: it takes the right to write there, not only to be
// in the same company.

const {
  controller,
  mailingService,
  mockMailing,
  resetMocks,
  user,
  MAILING_ID,
} = require('./update-mosaico.harness.js');
const {
  Galleries,
} = require('../../../packages/server/common/models.common.js');

function duplicate() {
  return new Promise((resolve) => {
    controller.duplicate(
      { params: { mailingId: MAILING_ID }, user },
      { json: () => resolve(null) },
      resolve
    );
  });
}

beforeEach(() => {
  resetMocks();
  Galleries.findOne = jest.fn().mockResolvedValue(null);
});

describe('POST /mailings/:mailingId/duplicate', () => {
  it('refuses whoever cannot write where the original is', async () => {
    const mailing = mockMailing({}, '');
    mailing.duplicate = jest.fn();
    mailingService.assertUserCanEditMailing.mockRejectedValue(
      Object.assign(new Error('FORBIDDEN_RESOURCE_OR_ACTION'), { status: 403 })
    );

    expect(await duplicate()).toMatchObject({ status: 403 });
    expect(mailingService.assertUserCanEditMailing).toHaveBeenCalledWith(
      user,
      mailing
    );
    expect(mailing.duplicate).not.toHaveBeenCalled();
  });
});
