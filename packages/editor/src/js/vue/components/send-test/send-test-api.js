const axios = require('axios');
const isEmail = require('validator/lib/isEmail');
const { getEmailGroups, sendTestEmails } = require('../../utils/apis');

// Sending a test email, as the quality drawer does it. The server route
// (POST /api/mailings/:mailingId/mosaico/send-test-mail) takes the addresses
// as one string separated by semicolons, plus an optional list of addresses.

// The addresses of a semicolon-separated list, trimmed, empty ones dropped.
const addressesOf = (value) =>
  String(value || '')
    .split(';')
    .map((address) => address.trim())
    .filter(Boolean);

/**
 * Whether every address of a semicolon-separated list is an email. An empty
 * list is valid: a saved list of addresses may be enough.
 */
function areEmails(value) {
  return addressesOf(value).every((address) => isEmail(address));
}

/**
 * The list as the server reads it: it splits on ";" and checks each part as
 * it is, so "a@b.co; c@d.fr" must lose its spaces before it is sent.
 * @param {string} value
 * @returns {string}
 */
function normalizeRecipients(value) {
  return addressesOf(value).join(';');
}

/**
 * The company's saved lists of test addresses, as select options. A super
 * admin's editor has no company: there is nothing to ask for.
 * @returns {Promise<Array<{ label: string, code: string }>>}
 */
function fetchEmailGroups(vm) {
  const groupId = vm.metadata && vm.metadata.groupId;
  if (!groupId) return Promise.resolve([]);
  return axios.get(getEmailGroups({ groupId })).then((response) =>
    (response.data.items || []).map((group) => ({
      label: group.name,
      code: group.id,
    }))
  );
}

/**
 * Sends the email to the recipients.
 * @param {Object} vm
 * @param {{ recipients: string, emailsGroupId?: string, html?: string }} to -
 *   `html`: the export to send, when the caller already has it
 * @returns {Promise}
 */
function sendTestEmail(vm, { recipients, emailsGroupId, html }) {
  const data = {
    rcpt: normalizeRecipients(recipients),
    html: typeof html === 'string' ? html : vm.exportHTML(),
  };
  if (emailsGroupId) data.emailsGroupId = emailsGroupId;
  return axios.post(sendTestEmails({ mailingId: vm.metadata.id }), data);
}

module.exports = {
  areEmails,
  normalizeRecipients,
  fetchEmailGroups,
  sendTestEmail,
};
