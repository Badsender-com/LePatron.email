'use_strict';

const SibApiV3Sdk = require('sib-api-v3-sdk');
const mailingService = require('../mailing/mailing.service.js');
const ERROR_CODES = require('../constant/error-codes.js');

const { InternalServerError } = require('http-errors');

class SendinBlueProvider {
  constructor({ apiKey, ...data }) {
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    this.apiKey = defaultClient.authentications['api-key'];
    this.apiKey.apiKey = apiKey;
    this.data = data;
  }

  async connectApi() {
    const apiAccountInstance = new SibApiV3Sdk.AccountApi();
    return await apiAccountInstance.getAccount();
  }

  async getCampaignMail({ campaignMailId }) {
    const apiEmailCampaignsInstance = new SibApiV3Sdk.EmailCampaignsApi();

    if (!campaignMailId) {
      throw new InternalServerError(
        ERROR_CODES.MISSING_PROPERTIES_CAMPAIGN_MAIL_ID
      );
    }
    const campaignId = campaignMailId;
    const apiEmailCampaignResult = await apiEmailCampaignsInstance.getEmailCampaign(
      campaignId
    );

    return {
      name: apiEmailCampaignResult?.name,
      senderName: apiEmailCampaignResult?.sender.name,
      senderMail: apiEmailCampaignResult?.sender.email,
      replyTo: apiEmailCampaignResult?.replyTo,
      subject: apiEmailCampaignResult?.subject,
    };
  }

  async createCampaignMail({ espSendingMailData, user, html, mailingId }) {
    const apiEmailCampaignsInstance = new SibApiV3Sdk.EmailCampaignsApi();
    let emailCampaignsData = new SibApiV3Sdk.CreateEmailCampaign();
    const processedHtml = mailingService.processHtmlWithFTPOption({
      user,
      html,
      mailingId,
    });

    emailCampaignsData = {
      emailCampaignsData,
      ...espSendingMailData,
      htmlContent: processedHtml,
    };
    const createCampaignApiResult = await apiEmailCampaignsInstance.createEmailCampaign(
      emailCampaignsData
    );
    if (!createCampaignApiResult?.id) {
      throw new InternalServerError(ERROR_CODES.MALFORMAT_ESP_RESPONSE);
    }
    return createCampaignApiResult?.id;
  }
}

module.exports = SendinBlueProvider;
