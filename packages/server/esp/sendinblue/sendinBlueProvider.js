'use_strict';
const logger = require('../../utils/logger.js');

const SibApiV3Sdk = require('sib-api-v3-sdk');
const mailingService = require('../../mailing/mailing.service.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const ESP_CONTENT_TYPE = require('../../constant/content-esp-type.js');

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

  static async build(initialData) {
    return new SendinBlueProvider(initialData);
  }

  async getCampaignMail({ campaignId }) {
    const apiEmailCampaignsInstance = new SibApiV3Sdk.EmailCampaignsApi();

    if (!campaignId) {
      throw new InternalServerError(
        ERROR_CODES.MISSING_PROPERTIES_CAMPAIGN_MAIL_ID
      );
    }
    const apiEmailCampaignResult = await apiEmailCampaignsInstance.getEmailCampaign(
      campaignId
    );

    return {
      name: apiEmailCampaignResult?.name,
      additionalApiData: {
        senderName: apiEmailCampaignResult?.sender.name,
        senderMail: apiEmailCampaignResult?.sender.email,
        replyTo: apiEmailCampaignResult?.replyTo,
      },
      subject: apiEmailCampaignResult?.subject,
    };
  }

  async getTemplate({ campaignId }) {
    const apiTemplateInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    if (!campaignId) {
      throw new InternalServerError(ERROR_CODES.MISSING_PROPERTIES_TEMPLATE_ID);
    }
    const apiTemplateResult = await apiTemplateInstance.getSmtpTemplate(
      campaignId
    );

    return {
      name: apiTemplateResult?.name,
      additionalApiData: {
        senderName: apiTemplateResult?.sender.name,
        senderMail: apiTemplateResult?.sender.email,
        replyTo: apiTemplateResult?.replyTo,
      },
      subject: apiTemplateResult?.subject,
    };
  }

  async createCampaignMail({ campaignMailData, user, html, mailingId, skipHtmlProcessing = false }) {
    try {
      const apiEmailCampaignsInstance = new SibApiV3Sdk.EmailCampaignsApi();
      let emailCampaignsData = new SibApiV3Sdk.CreateEmailCampaign();

      emailCampaignsData = await this.formatSendinBlueData({
        campaignMailData,
        user,
        html,
        mailingId,
        skipHtmlProcessing,
      });

      const createCampaignApiResult = await apiEmailCampaignsInstance.createEmailCampaign(
        emailCampaignsData
      );

      if (!createCampaignApiResult?.id) {
        throw new InternalServerError(ERROR_CODES.MALFORMAT_ESP_RESPONSE);
      }

      return createCampaignApiResult?.id;
    } catch (e) {
      logger.error('Sendinblue createCampaignMail error:', e.response?.text || e.message || e);
      throw e;
    }
  }

  async createTemplate({ campaignMailData, user, html, mailingId, skipHtmlProcessing = false }) {
    try {
      const apiTemplateInstance = new SibApiV3Sdk.TransactionalEmailsApi();
      let templateData = new SibApiV3Sdk.CreateSmtpTemplate();

      templateData = await this.formatSendinBlueData({
        campaignMailData,
        user,
        html,
        mailingId,
        skipHtmlProcessing,
      });

      const createTemplateApiResult = await apiTemplateInstance.createSmtpTemplate(
        {
          ...templateData,
          isActive: true,
        }
      );

      if (!createTemplateApiResult?.id) {
        throw new InternalServerError(ERROR_CODES.MALFORMAT_ESP_RESPONSE);
      }
      return createTemplateApiResult?.id;
    } catch (e) {
      logger.error('Sendinblue createTemplate error:', e.response?.text || e.message || e);
      throw e;
    }
  }

  async updateTemplate({
    campaignMailData,
    user,
    html,
    mailingId,
    campaignId,
    skipHtmlProcessing = false,
  }) {
    try {
      console.log('update a template ...');

      const apiTemplateInstance = new SibApiV3Sdk.TransactionalEmailsApi();
      let templateData = new SibApiV3Sdk.UpdateSmtpTemplate();

      templateData = await this.formatSendinBlueData({
        campaignMailData,
        user,
        html,
        mailingId,
        skipHtmlProcessing,
      });

      await apiTemplateInstance.updateSmtpTemplate(campaignId, {
        ...templateData,
        isActive: true,
      });

      return;
    } catch (e) {
      logger.error('Sendinblue updateTemplate error:', e.response?.text || e.message || e);
      throw e;
    }
  }

  async updateCampaignMail({
    campaignMailData,
    user,
    html,
    mailingId,
    campaignId,
    skipHtmlProcessing = false,
  }) {
    try {
      const apiEmailCampaignsInstance = new SibApiV3Sdk.EmailCampaignsApi();
      let emailCampaignsData = new SibApiV3Sdk.UpdateEmailCampaign();
      emailCampaignsData = await this.formatSendinBlueData({
        campaignMailData,
        user,
        html,
        mailingId,
        skipHtmlProcessing,
      });

      return await apiEmailCampaignsInstance.updateEmailCampaign(
        campaignId,
        emailCampaignsData
      );
    } catch (e) {
      logger.error('Sendinblue updateCampaignMail error:', e.response?.text || e.message || e);
      throw e;
    }
  }

  async formatSendinBlueData({ campaignMailData, user, html, mailingId, skipHtmlProcessing = false }) {
    try {
      // If skipHtmlProcessing is true, the HTML has already been processed (e.g., by handleEspDelivery)
      const processedHtml = skipHtmlProcessing
        ? html
        : await mailingService.processHtmlWithFTPOption({
            user,
            html,
            mailingId,
            doesWaitForFtp: false,
          });

      const {
        senderName,
        senderMail,
        subject,
        name,
        replyTo,
        contentSendType,
      } = campaignMailData;

      const typeNameFormat =
        ESP_CONTENT_TYPE.MAIL === contentSendType
          ? { name }
          : { templateName: name };

      return {
        subject,
        ...typeNameFormat,
        replyTo,
        sender: {
          name: senderName,
          email: senderMail,
        },
        htmlContent: processedHtml,
      };
    } catch (e) {
      throw new InternalServerError(
        ERROR_CODES.UNEXPECTED_ERROR_WHILE_PROCESSING_HTML
      );
    }
  }
}

module.exports = SendinBlueProvider;
