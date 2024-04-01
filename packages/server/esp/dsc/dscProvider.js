'use_strict';
const logger = require('../../utils/logger.js');
const mailingService = require('../../mailing/mailing.service.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const config = require('../../node.config.js');
const axios = require('../../config/axios');
const { InternalServerError, Conflict } = require('http-errors');

class DscProvider {
  constructor({ apiKey, ...data }) {
    this.apiKey = apiKey;
    this.data = data;
  }

  async connectApiCall() {
    return axios.get(`${config.dscUrl}/`, {
      headers: { apiKey: this.apiKey, 'Content-Type': 'application/json' },
    });
  }

  async connectApi() {
    try {
      const emailCampaignConnectionResult = await this.connectApiCall();
      return emailCampaignConnectionResult;
    } catch (e) {
      logger.error({ errorResponseData: e?.response?.data });
      if (e?.response?.status === 405) {
        return true;
      }

      if (e?.response?.status === 500) {
        logger.error({ errorMessage: e?.response?.data?.message });
        throw new InternalServerError(ERROR_CODES.UNEXPECTED_SERVER_ERROR);
      }

      if (e?.response?.status === 503) {
        throw new InternalServerError(
          ERROR_CODES.IP_ADDRESS_IS_NOT_ALLOWED_OR_WRONG_KEY
        );
      }

      logger.error({ Error: e?.response?.data?.message });
      throw e;
    }
  }

  async getCampaignMailApi({ campaignId }) {
    return axios.get(`${config.dscUrl}/${campaignId}`, {
      headers: {
        apiKey: this.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async createCampaignMailApi({ typeCampagne, ...restData }) {
    const url = `${config.dscUrl}/badSender/configuration/withTypeCampagne`;
    try {
      return await axios.post(url, restData, {
        headers: { apiKey: this.apiKey, 'Content-Type': 'application/json' },
        params: { typeCampagne },
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateCampaignMailApi({ typeCampagne, ...restData }, campaignMailId) {
    const url = `${config.dscUrl}/badSender/configuration/withTypeCampagne/${campaignMailId}`;
    try {
      return await axios.put(url, restData, {
        headers: { apiKey: this.apiKey, 'Content-Type': 'application/json' },
        params: { typeCampagne },
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  handleError(error) {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;
    const responseBody = error?.response?.data;

    if (status === 400) {
      if (message.includes('BADSENDER_ID_FORMAT_ERROR')) {
        // Include the actual ID in the error message
        const detailedMessage = `BADSENDER_ID_FORMAT_ERROR: The campaign '${responseBody?.id}' does not have the expected format.`;
        throw new Error(detailedMessage);
      }
      if (message.includes('La combinaison code campagne')) {
        // Include the actual ID and typeCampagne in the error message
        const detailedMessage = `The combination of campaign code '${responseBody?.id}' and type of campaign '${responseBody?.typeCampagne}' is invalid. Please correct it or contact your administrator.`;
        throw new Error(detailedMessage);
      }
    }

    // Log the error and throw a generic error if it doesn't match specific cases
    logger.error('Error in API call:', error);
    throw new Error('An error occurred while communicating with the API.');
  }

  async getCampaignMail({ campaignId }) {
    try {
      logger.log('Fetching campaign mail for DSC: ', campaignId);
      if (!campaignId) {
        throw new InternalServerError(
          ERROR_CODES.MISSING_PROPERTIES_CAMPAIGN_MAIL_ID
        );
      }

      const emailCampaignResult = await this.getCampaignMailApi({ campaignId });

      const {
        id,
        object,
        senderMail,
        senderName,
        replyToMail,
        planification,
      } = emailCampaignResult?.data;

      return {
        name: id,
        additionalApiData: {
          senderName,
          senderMail,
          id: id,
          replyTo: replyToMail,
          planification,
        },
        subject: object,
      };
    } catch (e) {
      logger.error({ error: e });

      throw e;
    }
  }

  async createCampaignMail({ campaignMailData, user, html, mailingId }) {
    try {
      logger.log('Creating campaign mail for DSC: ', campaignMailData?.name);
      const emailCampaignsData = await this.formatDscData({
        campaignMailData,
        user,
        html,
        mailingId,
      });

      const createCampaignApiResult = await this.createCampaignMailApi(
        emailCampaignsData
      );

      if (!createCampaignApiResult?.data?.id) {
        throw new InternalServerError(ERROR_CODES.MALFORMAT_ESP_RESPONSE);
      }

      return createCampaignApiResult?.data?.id;
    } catch (e) {
      if (e?.response?.status === 409) {
        throw new Conflict(ERROR_CODES.ALREADY_USED_MAIL_NAME);
      }
      logger.error(e?.response?.data?.message);
      logger.error(`Error: ${e?.response?.message?.data?.message}`);
      throw e;
    }
  }

  async updateCampaignMail({ campaignMailData, user, html, mailingId }) {
    try {
      logger.log('Updating campaign mail for DSC: ', campaignMailData?.name);

      const emailCampaignsData = await this.formatDscData({
        campaignMailData,
        user,
        html,
        mailingId,
      });

      const updateCampaignApiResult = await this.updateCampaignMailApi(
        emailCampaignsData,
        emailCampaignsData.id
      );

      if (!updateCampaignApiResult?.data?.id) {
        throw new InternalServerError(ERROR_CODES.MALFORMAT_ESP_RESPONSE);
      }

      return updateCampaignApiResult?.id;
    } catch (e) {
      if (e?.response?.status === 409) {
        throw new Conflict(ERROR_CODES.ALREADY_USED_MAIL_NAME);
      }

      logger.error(e?.response?.data?.message);
      throw e;
    }
  }

  static async build(initialData) {
    return new DscProvider(initialData);
  }

  async formatDscData({ campaignMailData, user, html, mailingId }) {
    try {
      const processedHtml = await mailingService.processHtmlWithFTPOption({
        user,
        html,
        mailingId,
        doesWaitForFtp: false,
      });

      const {
        senderName,
        senderMail,
        subject,
        replyTo,
        name,
        planification,
      } = campaignMailData;

      let formattedData = {
        id: name,
        object: subject,
        replyToMail: replyTo,
        senderName,
        senderMail,
        template: processedHtml,
        controlMail: user?.email || '',
      };

      if (planification) {
        formattedData = {
          ...formattedData,
          planification,
        };
      }
      return formattedData;
    } catch (e) {
      throw new InternalServerError(
        ERROR_CODES.UNEXPECTED_ERROR_WHILE_PROCESSING_HTML
      );
    }
  }
}

module.exports = DscProvider;
