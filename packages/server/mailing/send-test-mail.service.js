'use strict';

const isEmail = require('validator/lib/isEmail');
const ERROR_CODES = require('../constant/error-codes.js');
const logger = require('../utils/logger.js');
const { onlyUnique } = require('../utils/array.js');
const mailingService = require('./mailing.service.js');
const emailsGroupService = require('../emails-group/emails-group.service');
const processMosaicoHtmlRender = require('../utils/process-mosaico-html-render.js');

const { BadRequest } = require('http-errors');
const mail = require('../mailing/mail.service.js');

// The addresses one test send reaches, the list added included: a test goes
// to the team and its testing tools, a campaign goes through an ESP.
const MAX_TEST_RECIPIENTS = 100;
// The test sends of one account in an hour, on the route
// (mailing.routes.js): an editing session sends a few, not hundreds.
const TEST_SENDS_PER_HOUR_PER_ACCOUNT = 60;

module.exports = {
  sendTestMail,
  MAX_TEST_RECIPIENTS,
  TEST_SENDS_PER_HOUR_PER_ACCOUNT,
};

async function sendTestMail({
  mailingId,
  emailsGroupId,
  rcpt,
  htmlFromEditor,
  user,
}) {
  if (typeof rcpt !== 'string') {
    throw new BadRequest(ERROR_CODES.EMAIL_NOT_VALID);
  }

  const mailing = await mailingService.getMailNameAndCompanyByMailingIdAndUser({
    mailingId,
    user,
  });
  // The email of the user's company, in a workspace or folder it may read.
  await mailingService.assertUserCanReadMailing(user, mailing);

  // body.html is the result of viewModel.exportHTML()
  // • in /src/js/ext/badsender-server-storage.js
  const html = processMosaicoHtmlRender(htmlFromEditor);

  let adresses = rcpt.split(';');

  if (!!emailsGroupId && typeof emailsGroupId !== 'undefined') {
    // A list of the email's company: the sender's own, or for a super admin
    // the company of the email it is working on.
    const emailGroups = await emailsGroupService.getEmailsGroupOfGroup({
      groupId: mailing._company,
      emailsGroupId,
    });

    if (emailGroups && emailGroups.emails) {
      adresses = [...adresses, ...emailGroups.emails.split(';')];
    }
  }

  adresses = adresses.filter(onlyUnique).filter((email) => !!email);

  if (adresses.length > MAX_TEST_RECIPIENTS) {
    throw new BadRequest(ERROR_CODES.TOO_MANY_TEST_RECIPIENTS);
  }

  for (const mail of adresses) {
    if (!isEmail(mail)) {
      throw new BadRequest(ERROR_CODES.EMAIL_NOT_VALID);
    }
  }

  for (const address of adresses) {
    try {
      const mailInfo = await mail.send({
        to: address,
        replyTo: user?.email,
        // Now that an email carries a real subject, a test send should show it.
        // Falls back on the mailing name, which is what every existing mailing
        // has and what this used to send unconditionally.
        subject: mailing.subject || mailing.name,
        html,
      });

      logger.log('Message sent: ', mailInfo.response);
    } catch (error) {
      logger.error('Error occured while sent email: ', address);
      logger.error('Error ', error.message);
    }
  }

  return adresses;
}
