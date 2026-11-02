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
  Mailings,
} = require('../../../packages/server/common/models.common.js');
const fileManager = require('../../../packages/server/common/file-manage.service.js');

function duplicate() {
  return new Promise((resolve) => {
    controller.duplicate(
      { params: { mailingId: MAILING_ID }, user },
      { json: (body) => resolve({ body }) },
      resolve
    );
  });
}

const COPY_ID = 'copy-1';

beforeEach(() => {
  resetMocks();
  Galleries.findOne = jest.fn().mockResolvedValue(null);
  fileManager.copyImages = jest.fn().mockResolvedValue();
  Mailings.findById = jest
    .fn()
    .mockResolvedValue({ toJSON: () => ({ id: COPY_ID }) });
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

  it('saves the copy, after the check, for whoever may write there', async () => {
    const mailing = mockMailing({}, '');
    const copy = { _id: COPY_ID, save: jest.fn().mockResolvedValue() };
    mailing.duplicate = jest.fn().mockReturnValue(copy);

    expect(await duplicate()).toEqual({ body: { id: COPY_ID } });
    expect(copy.save).toHaveBeenCalled();
    expect(
      mailingService.assertUserCanEditMailing.mock.invocationCallOrder[0]
    ).toBeLessThan(fileManager.copyImages.mock.invocationCallOrder[0]);
  });
});
