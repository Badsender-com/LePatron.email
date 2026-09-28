const axios = require('axios');
const isEmail = require('validator/lib/isEmail');
const { getEmailGroups, sendTestEmails } = require('../../utils/apis');

// Sending a test email, as the quality drawer does it. The server route
// (POST /api/mailings/:mailingId/mosaico/send-test-mail) takes the addresses
// as one string separated by semicolons, plus an optional list of addresses.

/**
 * Whether every address of a semicolon-separated list is an email. An empty
 * list is valid: a saved list of addresses may be enough.
 */
function areEmails(value) {
  if (!value || !value.trim()) return true;
  return value
    .split(';')
    .map((address) => address.trim())
    .filter(Boolean)
    .every((address) => isEmail(address));
}

/**
 * The company's saved lists of test addresses, as select options.
 * @returns {Promise<Array<{ label: string, code: string }>>}
 */
function fetchEmailGroups(vm) {
  return axios
    .get(getEmailGroups({ groupId: vm.metadata.groupId }))
    .then((response) =>
      (response.data.items || []).map((group) => ({
        label: group.name,
        code: group.id,
      }))
    );
}

/**
 * Sends the email as it is now to the recipients.
 * @param {Object} vm
 * @param {{ recipients: string, emailsGroupId?: string }} to
 * @returns {Promise}
 */
function sendTestEmail(vm, { recipients, emailsGroupId }) {
  const data = { rcpt: recipients || '', html: vm.exportHTML() };
  if (emailsGroupId) data.emailsGroupId = emailsGroupId;
  return axios.post(sendTestEmails({ mailingId: vm.metadata.id }), data);
}

module.exports = { areEmails, fetchEmailGroups, sendTestEmail };
