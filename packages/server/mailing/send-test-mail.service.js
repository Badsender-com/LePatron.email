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

module.exports = {
  sendTestMail,
};

async function sendTestMail({
  mailingId,
  emailsGroupId,
  rcpt,
  htmlFromEditor,
  user,
}) {
  const mailing = await mailingService.getMailNameAndCompanyByMailingIdAndUser({
    mailingId,
    user,
  });

  // TODO: add back group check
  // if (!isFromCompany(user, mailing._company)) throw new createError.Unauthorized()

  // body.html is the result of viewModel.exportHTML()
  // • in /src/js/ext/badsender-server-storage.js
  const html = processMosaicoHtmlRender(htmlFromEditor);

  let adresses = rcpt.split(';');

  if (!!emailsGroupId && typeof emailsGroupId !== 'undefined') {
    const emailGroups = await emailsGroupService.getEmailsGroup({
      userGroupId: user.group?.id,
      emailsGroupId,
    });

    if (emailGroups && emailGroups.emails) {
      adresses = [...adresses, ...emailGroups.emails.split(';')];
    }
  }

  adresses = adresses.filter(onlyUnique).filter((email) => !!email);

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
        subject: mailing.name,
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
