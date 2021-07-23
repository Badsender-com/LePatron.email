
const prefixApi = '/api'

function getEspIds({ mailingId}) {
  return `${prefixApi}/mailings/${mailingId}/esp-ids`
}

function getProfileDetail({ profileId }) {
  return `${prefixApi}/profiles/${profileId}/`
}

function getCampaignDetail({ profileId, campaignId }) {
  return `${prefixApi}/profiles/${profileId}/campaign-mail/${campaignId}`
}


module.exports = {
  getEspIds,
  getProfileDetail,
  getCampaignDetail
}
