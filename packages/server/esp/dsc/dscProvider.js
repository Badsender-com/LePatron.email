'use_strict';
const logger = require('../../utils/logger.js');
const mailingService = require('../../mailing/mailing.service.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const config = require('../../node.config.js');
const axios = require('axios');
const { InternalServerError, Conflict } = require('http-errors');
const url = require('url');
class DscProvider {
  constructor({ apiKey, ...data }) {
    this.apiKey = apiKey;
    this.data = data;
  }

  getOptionsInformation() {
    try {
      let options = {};
      if (config.proxyUrl) {
        const proxy = new url.URL(config.proxyUrl);
        const target = new url.URL(config.dscUrl);
        if (typeof proxy !== 'undefined' && typeof target !== 'undefined') {
          options = {
            hostname: proxy.hostname,
            port: proxy.port || 80,
            path: target.href,
            headers: {
              Host: target.hostname,
            },
            auth: {
              username: proxy.username,
              password: proxy.password,
            },
          };
        }
      }

      if (options.headers?.Host) {
        options = {
          apiKey: this.apiKey,
          contentType: 'application/json',
          ...options,
        };
      } else {
        options = {
          headers: { apiKey: this.apiKey, contentType: 'application/json' },
        };
      }
      return { proxy: options };
    } catch (e) {
      logger.error(e);
      throw new InternalServerError(
        ERROR_CODES.UNEXPECTED_ERROR_WHILE_PROCESSING_PROXY
      );
    }
  }

  async connectApiCall() {
    return axios.get(`${config.dscUrl}/`, this.getOptionsInformation());
  }

  async connectApi() {
    logger.log({ urlDSC: config.dscUrl });
    try {
      const emailCampaignConnectionResult = await this.connectApiCall();
      return emailCampaignConnectionResult;
    } catch (e) {
      logger.error({ errorResponse: e?.response });
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
    return axios.get(
      `${config.dscUrl}/${campaignId}`,
      this.getOptionsInformation()
    );
  }

  async createCampaignMailApi(data) {
    return axios.post(`${config.dscUrl}/`, data, this.getOptionsInformation());
  }

  async updateCampaignMailApi(data, campaignMailId) {
    return axios.post(
      `${config.dscUrl}/${campaignMailId}`,
      data,
      this.getOptionsInformation()
    );
  }

  async getCampaignMail({ campaignId }) {
    try {
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
      } = emailCampaignResult?.data;

      return {
        name: id,
        additionalApiData: {
          senderName: senderName,
          senderMail: senderMail,
          id: id,
          replyTo: replyToMail,
        },
        subject: object,
      };
    } catch (e) {
      logger.error(e.response);

      throw e;
    }
  }

  async createCampaignMail({ campaignMailData, user, html, mailingId }) {
    try {
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
      logger.error(e?.response?.message);
      throw e;
    }
  }

  async updateCampaignMail({ campaignMailData, user, html, mailingId }) {
    try {
      const emailCampaignsData = await this.formatDscData({
        campaignMailData,
        user,
        html,
        mailingId,
      });

      console.log({
        id: emailCampaignsData.id,
        object: emailCampaignsData.subject,
        replyToMail: emailCampaignsData.replyTo,
        senderName: emailCampaignsData.senderName,
        senderMail: emailCampaignsData.senderMail,
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

      logger.error(e?.response?.message);
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
      } = campaignMailData;

      return {
        id: name,
        object: subject,
        replyToMail: replyTo,
        senderName,
        senderMail,
        template: processedHtml,
      };
    } catch (e) {
      throw new InternalServerError(
        ERROR_CODES.UNEXPECTED_ERROR_WHILE_PROCESSING_HTML
      );
    }
  }
}

module.exports = DscProvider;
