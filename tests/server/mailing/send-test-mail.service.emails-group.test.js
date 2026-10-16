'use strict';

// A test send can add a list of addresses: a list of the email's company. A
// super admin working on a client's email sends to that client's lists, not
// to the platform's; anyone else's email is of their own company already.

jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  getMailNameAndCompanyByMailingIdAndUser: jest.fn(),
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

const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const emailsGroupService = require('../../../packages/server/emails-group/emails-group.service');
const mail = require('../../../packages/server/mailing/mail.service.js');
const {
  sendTestMail,
} = require('../../../packages/server/mailing/send-test-mail.service.js');

const PLATFORM = '507f1f77bcf86cd799439a01';
const CLIENT = '507f1f77bcf86cd799439a02';

beforeEach(() => {
  jest.clearAllMocks();
  mailingService.getMailNameAndCompanyByMailingIdAndUser.mockResolvedValue({
    name: 'Newsletter',
    _company: CLIENT,
  });
  emailsGroupService.getEmailsGroupOfGroup.mockResolvedValue({
    emails: 'list@client.test',
  });
});

const send = (user) =>
  sendTestMail({
    mailingId: 'm1',
    emailsGroupId: 'list-1',
    rcpt: 'me@client.test',
    htmlFromEditor: '<p>hi</p>',
    user,
  });

describe('sendTestMail, with a list of addresses', () => {
  it.each([
    [
      'a super admin of the platform',
      { role: 'super_admin', group: { id: PLATFORM } },
    ],
    ['a member of the company', { role: 'writer', group: { id: CLIENT } }],
  ])("reads the list among the email's company's, for %s", async (_l, user) => {
    await send(user);

    expect(emailsGroupService.getEmailsGroupOfGroup).toHaveBeenCalledWith({
      groupId: CLIENT,
      emailsGroupId: 'list-1',
    });
    expect(mail.send.mock.calls.map(([{ to }]) => to).sort()).toEqual([
      'list@client.test',
      'me@client.test',
    ]);
  });
});
