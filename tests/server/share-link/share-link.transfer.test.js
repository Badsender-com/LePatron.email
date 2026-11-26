'use strict';

// A transfer gives an email to another user, often in another company: the
// public preview links made for the previous owner must not follow it, nor the
// metadata that belong to the previous company (the email type and the company
// dimension values, ADR-0032).

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: { findById: jest.fn() },
  Users: { findById: jest.fn() },
  Galleries: {},
  Templates: {},
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({}));
jest.mock('../../../packages/server/share-link/share-link.service.js', () => ({
  revokeAllForMailing: jest.fn(),
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
  Users,
} = require('../../../packages/server/common/models.common.js');
const shareLinkService = require('../../../packages/server/share-link/share-link.service.js');
const controller = require('../../../packages/server/mailing/mailing.controller.js');

const MAILING_ID = '507f1f77bcf86cd799439001';
const USER_ID = '507f1f77bcf86cd799439099';

function transfer() {
  return new Promise((resolve) => {
    const res = { json: () => resolve(null) };
    controller.transferToUser(
      { params: { mailingId: MAILING_ID }, body: { userId: USER_ID } },
      res,
      resolve
    );
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  shareLinkService.revokeAllForMailing.mockResolvedValue();
});

describe('POST /mailings/:mailingId/transfer-to-user', () => {
  it('revokes every preview link of the email before handing it over', async () => {
    const order = [];
    const mailing = {
      _id: MAILING_ID,
      _company: 'c1',
      _wireframe: { _company: 'c2' },
      save: jest.fn(async () => order.push('save')),
    };
    Users.findById.mockResolvedValue({
      _id: USER_ID,
      name: 'Ana',
      _company: 'c2',
    });
    Mailings.findById.mockImplementation((id, projection) =>
      projection
        ? { populate: () => Promise.resolve(mailing) }
        : Promise.resolve({ toJSON: () => ({ id }) })
    );
    shareLinkService.revokeAllForMailing.mockImplementation(async () =>
      order.push('revoke')
    );

    expect(await transfer()).toBeNull();

    expect(shareLinkService.revokeAllForMailing).toHaveBeenCalledWith(
      MAILING_ID
    );
    expect(order).toEqual(['revoke', 'save']);
  });

  it('leaves the email where it was when the links cannot be revoked', async () => {
    const mailing = {
      _id: MAILING_ID,
      _company: 'c1',
      _wireframe: { _company: 'c2' },
      save: jest.fn(),
    };
    Users.findById.mockResolvedValue({ _id: USER_ID, _company: 'c2' });
    Mailings.findById.mockReturnValue({
      populate: () => Promise.resolve(mailing),
    });
    const failure = new Error('Mongo down');
    shareLinkService.revokeAllForMailing.mockRejectedValue(failure);

    expect(await transfer()).toBe(failure);
    expect(mailing.save).not.toHaveBeenCalled();
  });

  it('keeps the links of an email that was not transferred', async () => {
    Users.findById.mockResolvedValue({ _id: USER_ID, _company: 'c2' });
    Mailings.findById.mockReturnValue({
      populate: () =>
        Promise.resolve({ _company: 'c1', _wireframe: { _company: 'c3' } }),
    });

    expect(await transfer()).toMatchObject({ status: 400 });
    expect(shareLinkService.revokeAllForMailing).not.toHaveBeenCalled();
  });
});

describe('the company metadata of a transferred email', () => {
  const EMAIL_TYPE_ID = '507f1f77bcf86cd799439101';
  const VALUE_ID = '507f1f77bcf86cd799439102';

  function transferFrom(company) {
    const mailing = {
      _id: MAILING_ID,
      _company: company,
      _wireframe: { _company: 'c2' },
      _emailType: EMAIL_TYPE_ID,
      _taxonomyItems: [VALUE_ID],
      trigger: 'automated',
      save: jest.fn(),
    };
    Users.findById.mockResolvedValue({
      _id: USER_ID,
      name: 'Ana',
      _company: 'c2',
    });
    Mailings.findById.mockImplementation((id, projection) =>
      projection
        ? { populate: () => Promise.resolve(mailing) }
        : Promise.resolve({ toJSON: () => ({ id }) })
    );
    return transfer().then((error) => ({ error, mailing }));
  }

  it('drops the email type and the dimension values when the company changes', async () => {
    const { error, mailing } = await transferFrom('c1');

    expect(error).toBeNull();
    expect(mailing._emailType).toBeUndefined();
    expect(mailing._taxonomyItems).toBeUndefined();
    // The trigger is the doctrine's, not the company's: it follows the email.
    expect(mailing.trigger).toBe('automated');
    expect(mailing.save).toHaveBeenCalled();
  });

  it('keeps them when the email stays in its company', async () => {
    const { error, mailing } = await transferFrom('c2');

    expect(error).toBeNull();
    expect(mailing._emailType).toBe(EMAIL_TYPE_ID);
    expect(mailing._taxonomyItems).toEqual([VALUE_ID]);
    expect(mailing.save).toHaveBeenCalled();
  });
});
