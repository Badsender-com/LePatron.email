'use strict';

const asyncHandler = require('express-async-handler');

const sendTestMailService = require('./send-test-mail.service');

module.exports = asyncHandler(sendTestMail);

/**
 * @api {post} /mailings/:mailingId/mosaico/send-test-mail mailing test mail
 * @apiPermission user
 * @apiName SendMailingByMail
 * @apiGroup Mailings
 *
 * @apiParam {string} mailingId
 *
 * @apiParam (Body) {String} rcpt the recipient email address
 * @apiParam (Body) {String} emailGroupId The id of the emails group
 * @apiParam (Body) {String} html the HTML output get in mosaico by `viewModel.exportHTML()`
 *
 * @apiSuccess {String} mailingList the emails to which the mailing has been sent
 *
 */

async function sendTestMail(req, res) {
  const {
    user,
    body: { html: htmlFromEditor, rcpt, emailsGroupId },
  } = req;
  const { mailingId } = req.params;

  const resultSendingTestMail = await sendTestMailService.sendTestMail({
    user,
    rcpt,
    htmlFromEditor,
    emailsGroupId,
    mailingId,
  });

  res.json({ result: resultSendingTestMail });
}
