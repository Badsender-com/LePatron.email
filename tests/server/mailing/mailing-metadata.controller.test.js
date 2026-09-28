'use strict';

// The most sensitive part of the endpoint is not the validation, it is the access
// control: belonging to the company is not enough to edit a mailing, the user must
// have access to the workspace or the folder holding it. That check is shared with
// `updateMosaico` through `assertUserCanEditMailing` — here we pin that the metadata
// endpoint actually calls it, and that nothing is saved when it refuses.
//
// Also pinned: the response carries only the fields this endpoint owns. Returning
// `mailing.toJSON()` would ship `previewHtml`, the rendered email HTML the rest of
// the read paths take pains to strip. And it carries no preheader — that field is
// not part of this endpoint, and a response mentioning it would invite a client to
// send it.

jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  findOneForUser: jest.fn(),
  assertUserCanEditMailing: jest.fn(),
}));
jest.mock(
  '../../../packages/server/mailing/mailing-metadata.service.js',
  () => ({
    applyMetadataToMailing: jest.fn(),
  })
);

const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const mailingMetadataService = require('../../../packages/server/mailing/mailing-metadata.service.js');
const controller = require('../../../packages/server/mailing/mailing-metadata.controller.js');

const MAILING_ID = '507f1f77bcf86cd799439001';
const user = { id: 'user-1', isAdmin: false };

function makeMailing(overrides = {}) {
  return {
    id: MAILING_ID,
    subject: 'Soldes',
    plannedSendDate: new Date('2026-09-01'),
    _emailType: '507f1f77bcf86cd799439101',
    updatedAt: new Date('2026-08-01'),
    // Still present on the document — the template owns it, this endpoint does
    // not touch it either way.
    data: { preheaderText: 'laissé au template' },
    previewHtml: '<html>a very large rendered email</html>',
    save: jest.fn(),
    ...overrides,
  };
}

async function callEndpoint(mailing, body = {}) {
  mailingService.findOneForUser.mockResolvedValue(mailing);
  mailingService.assertUserCanEditMailing.mockResolvedValue(undefined);
  mailingMetadataService.applyMetadataToMailing.mockResolvedValue(undefined);

  const res = { json: jest.fn() };
  await controller.updateMetadata(
    { params: { mailingId: MAILING_ID }, body, user },
    res,
    (err) => {
      throw err;
    }
  );
  return { res, payload: res.json.mock.calls[0][0] };
}

beforeEach(() => {
  // resetAllMocks, not clearAllMocks: a rejection set up by one test would
  // otherwise leak into the next one.
  jest.resetAllMocks();
});

describe('PATCH /mailings/:mailingId/metadata — access control', () => {
  it('reads the mailing through the tenant-scoped lookup', async () => {
    await callEndpoint(makeMailing());

    expect(mailingService.findOneForUser).toHaveBeenCalledWith(
      MAILING_ID,
      user
    );
  });

  it('checks workspace/folder access before touching anything', async () => {
    const mailing = makeMailing();
    await callEndpoint(mailing);

    expect(mailingService.assertUserCanEditMailing).toHaveBeenCalledWith(
      user,
      mailing
    );
  });

  it('saves nothing when the access check refuses', async () => {
    const mailing = makeMailing();
    mailingService.findOneForUser.mockResolvedValue(mailing);
    mailingService.assertUserCanEditMailing.mockRejectedValue(
      Object.assign(new Error('FORBIDDEN_RESOURCE_OR_ACTION'), { status: 403 })
    );

    await expect(
      controller.updateMetadata(
        { params: { mailingId: MAILING_ID }, body: { subject: 'x' }, user },
        { json: jest.fn() },
        (err) => {
          throw err;
        }
      )
    ).rejects.toMatchObject({ status: 403 });

    expect(
      mailingMetadataService.applyMetadataToMailing
    ).not.toHaveBeenCalled();
    expect(mailing.save).not.toHaveBeenCalled();
  });

  it('propagates a validation failure without saving', async () => {
    const mailing = makeMailing();
    mailingService.findOneForUser.mockResolvedValue(mailing);
    mailingService.assertUserCanEditMailing.mockResolvedValue(undefined);
    mailingMetadataService.applyMetadataToMailing.mockRejectedValue(
      Object.assign(new Error('INVALID_EMAIL_METADATA'), { status: 422 })
    );

    await expect(
      controller.updateMetadata(
        { params: { mailingId: MAILING_ID }, body: { subject: 42 }, user },
        { json: jest.fn() },
        (err) => {
          throw err;
        }
      )
    ).rejects.toMatchObject({ status: 422 });

    expect(mailing.save).not.toHaveBeenCalled();
  });
});

describe('PATCH /mailings/:mailingId/metadata — response', () => {
  it('saves and answers with the fields this endpoint owns', async () => {
    const mailing = makeMailing();
    const { payload } = await callEndpoint(mailing, { subject: 'Soldes' });

    expect(mailing.save).toHaveBeenCalled();
    expect(payload).toEqual({
      id: MAILING_ID,
      subject: 'Soldes',
      plannedSendDate: mailing.plannedSendDate,
      emailTypeId: mailing._emailType,
      updatedAt: mailing.updatedAt,
    });
  });

  it('never mentions the preheader', async () => {
    const { payload } = await callEndpoint(makeMailing());

    expect(payload).not.toHaveProperty('preheader');
    expect(payload).not.toHaveProperty('preheaderWritten');
  });

  it('never ships previewHtml or data', async () => {
    const { payload } = await callEndpoint(makeMailing());

    expect(payload).not.toHaveProperty('previewHtml');
    expect(payload).not.toHaveProperty('data');
  });
});
