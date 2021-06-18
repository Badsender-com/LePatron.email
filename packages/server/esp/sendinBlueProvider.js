const SibApiV3Sdk = require('sib-api-v3-sdk');

class SendinBlueProvider {
  constructor({ apiKey, ...data }) {
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    this.apiKey = defaultClient.authentications['api-key'];
    this.apiKey.apiKey = apiKey;
    this.data = data;
    console.log(this.data);
  }

  async connectApi() {
    const apiEmailCampaignsInstance = new SibApiV3Sdk.AccountApi();
    return await apiEmailCampaignsInstance.getAccount();
  }

  async createCampaignMail(data) {
    const apiEmailCampaignsInstance = new SibApiV3Sdk.EmailCampaignsApi();
    let emailCampaignsData = new SibApiV3Sdk.CreateEmailCampaign();
    emailCampaignsData = {
      emailCampaignsData,
      ...data,
    };
    console.log(emailCampaignsData);
    return await apiEmailCampaignsInstance.createEmailCampaign(
      emailCampaignsData
    );
  }
}

module.exports = SendinBlueProvider;
