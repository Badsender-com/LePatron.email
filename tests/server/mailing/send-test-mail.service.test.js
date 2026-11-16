'use strict';

// A test send: the email is one the user may read, the addresses typed are a
// text of addresses separated by `;`, and one send reaches a bounded number
// of addresses, the list added included.

jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  getMailNameAndCompanyByMailingIdAndUser: jest.fn(),
  assertUserCanReadMailing: jest.fn(),
}));
jest.mock('../../../packages/server/emails-group/emails-group.service', () => ({
  getEmailsGroupOfGroup: jest.fn(),
}));
jest.mock('../../../packages/server/mailing/mail.service.js', () => ({
  send: jest.fn().mockResolvedValue({ response: 'ok' }),
}));
jest.mock(
  '../../../packages/server/utils/process-mosaico-html-render.js',
  () => (html) => html
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

const { NotFound } = require('http-errors');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const emailsGroupService = require('../../../packages/server/emails-group/emails-group.service');
const mail = require('../../../packages/server/mailing/mail.service.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const {
  sendTestMail,
  MAX_TEST_RECIPIENTS,
} = require('../../../packages/server/mailing/send-test-mail.service.js');

const CLIENT = '507f1f77bcf86cd799439a02';
const user = { role: 'regular_user', group: { id: CLIENT } };
const mailing = {
  name: 'Newsletter',
  _company: CLIENT,
  _workspace: '507f1f77bcf86cd799439a11',
};

const addresses = (count, domain = 'client.test') =>
  Array.from({ length: count }, (_, i) => `tester${i}@${domain}`);

const send = (rcpt, extra = {}) =>
  sendTestMail({
    mailingId: 'm1',
    rcpt,
    htmlFromEditor: '<p>hi</p>',
    user,
    ...extra,
  });

beforeEach(() => {
  jest.clearAllMocks();
  mailingService.getMailNameAndCompanyByMailingIdAndUser.mockResolvedValue(
    mailing
  );
  mailingService.assertUserCanReadMailing.mockResolvedValue(undefined);
});

describe('sendTestMail, the email sent', () => {
  it('asks the read rule of the email', async () => {
    await send('me@client.test');

    expect(mailingService.assertUserCanReadMailing).toHaveBeenCalledWith(
      user,
      mailing
    );
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when the rule refuses', async () => {
    mailingService.assertUserCanReadMailing.mockRejectedValue(new NotFound());

    await expect(send('me@client.test')).rejects.toMatchObject({
      status: 404,
    });
    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe('sendTestMail, the addresses', () => {
  it.each([
    ['missing', undefined],
    ['a number', 42],
    ['an array', ['me@client.test']],
    ['an object', { $ne: null }],
  ])('refuses addresses that are %s', async (_case, rcpt) => {
    await expect(send(rcpt)).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.EMAIL_NOT_VALID,
    });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it(`sends to ${MAX_TEST_RECIPIENTS} addresses`, async () => {
    await send(addresses(MAX_TEST_RECIPIENTS).join(';'));

    expect(mail.send).toHaveBeenCalledTimes(MAX_TEST_RECIPIENTS);
  });

  it('refuses more addresses than a test send reaches', async () => {
    await expect(
      send(addresses(MAX_TEST_RECIPIENTS + 1).join(';'))
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.TOO_MANY_TEST_RECIPIENTS,
    });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('counts the addresses of the list added', async () => {
    emailsGroupService.getEmailsGroupOfGroup.mockResolvedValue({
      emails: addresses(MAX_TEST_RECIPIENTS, 'list.test').join(';'),
    });

    await expect(
      send('me@client.test', { emailsGroupId: 'list-1' })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.TOO_MANY_TEST_RECIPIENTS,
    });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('counts an address repeated once', async () => {
    await send(
      [...addresses(MAX_TEST_RECIPIENTS), 'tester0@client.test'].join(';')
    );

    expect(mail.send).toHaveBeenCalledTimes(MAX_TEST_RECIPIENTS);
  });
});
