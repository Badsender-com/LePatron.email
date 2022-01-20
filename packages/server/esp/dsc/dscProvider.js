'use_strict';
const logger = require('../../utils/logger.js');
const mailingService = require('../../mailing/mailing.service.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const config = require('../../node.config.js');
const Axios = require('axios');
const { InternalServerError, Conflict } = require('http-errors');
const HttpsProxyAgent = require('https-proxy-agent');
const url = require('url');

let agent = null;
if (config.proxyUrl) {
  const proxy = new url.URL(config.proxyUrl);
  if (typeof proxy !== 'undefined') {
    agent = new HttpsProxyAgent(config.proxyUrl);
  }
}

const axios = agent
  ? Axios.create({
      proxy: false,
      httpsAgent: agent,
    })
  : Axios.create();

class DscProvider {
  constructor({ apiKey, ...data }) {
    this.apiKey = apiKey;
    this.data = data;
  }

  async connectApiCall() {
    return axios.get(`${config.dscUrl}/`, {
      headers: { apiKey: this.apiKey, contentType: 'application/json' },
    });
  }

  async connectApi() {
    logger.log({ urlDSC: config.dscUrl });
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
      headers: { apiKey: this.apiKey, contentType: 'application/json' },
    });
  }

  async createCampaignMailApi(data) {
    return axios.post(`${config.dscUrl}/`, data, {
      headers: { apiKey: this.apiKey, contentType: 'application/json' },
    });
  }

  async updateCampaignMailApi(data, campaignMailId) {
    return axios.put(`${config.dscUrl}/${campaignMailId}`, data, {
      headers: { apiKey: this.apiKey, contentType: 'application/json' },
    });
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
