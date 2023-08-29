const prefixApi = '/api';

function getEspIds({ mailingId }) {
  return `${prefixApi}/mailings/${mailingId}/esp-ids`;
}

function getProfileDetail({ profileId }) {
  return `${prefixApi}/profiles/${profileId}/`;
}

function getCampaignDetail({ profileId, campaignId }) {
  return `${prefixApi}/profiles/${profileId}/campaign-mail/${campaignId}`;
}

function getEmailGroups({ groupId }) {
  return `${prefixApi}/groups/${groupId}/email-groups`;
}

function sendTestEmails({ mailingId }) {
  return `${prefixApi}/mailings/${mailingId}/mosaico/send-test-mail`;
}

function createPersonalizedBlock() {
  return `${prefixApi}/personalized-blocks`;
}

module.exports = {
  getEspIds,
  getProfileDetail,
  getCampaignDetail,
  getEmailGroups,
  sendTestEmails,
  createPersonalizedBlock,
};
