const prefixApi = '/api';

function getEspIds({ mailingId }) {
  return `${prefixApi}/mailings/${mailingId}/esp-ids`;
}

function getProfileDetail({ profileId }) {
  return `${prefixApi}/profiles/${profileId}/`;
}

function getCampaignDetail({ profileId, campaignId }) {
  return `${prefixApi}/profiles/${profileId}/campaign-mail/${encodeURIComponent(campaignId)}`;
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

function getPersonalizedBlocks() {
  return `${prefixApi}/personalized-blocks`;
}

function editPersonalizedBlock(id) {
  return `${prefixApi}/personalized-blocks/${id}`;
}

function deletePersonalizedBlock(blockId) {
  return `${prefixApi}/personalized-blocks/${blockId}`;
}

function translateBlock() {
  return `${prefixApi}/translation/block`;
}

function getTranslationLanguages() {
  return `${prefixApi}/translation/languages`;
}

module.exports = {
  getEspIds,
  getProfileDetail,
  getCampaignDetail,
  getEmailGroups,
  sendTestEmails,
  createPersonalizedBlock,
  getPersonalizedBlocks,
  editPersonalizedBlock,
  deletePersonalizedBlock,
  translateBlock,
  getTranslationLanguages,
};
