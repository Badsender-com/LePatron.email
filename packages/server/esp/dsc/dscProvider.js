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
      console.log({
        config: config,
        proxyUrl: config.proxyUrl,
        dscUrl: config.dscUrl,
      });
      let options = {};
      if (config.proxyUrl) {
        const proxy = url.URL(config.proxyUrl);
        const target = url.URL(config.dscUrl);

        options = {
          hostname: proxy.hostname,
          port: proxy.port || 80,
          path: target.href,
          headers: {
            'Proxy-Authorization':
              'Basic ' + Buffer.from(proxy.auth).toString('base64'),
            Host: target.hostname,
          },
        };
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
      return options;
    } catch (e) {
      logger.error(e?.response?.message);
      throw new InternalServerError(
        ERROR_CODES.UNEXPECTED_ERROR_WHILE_PROCESSING_PROXY
      );
    }
  }

  async connectApiCall() {
    return axios.get(`${config.dscUrl}/`, this.getOptionsInformation());
  }

  async connectApi() {
    try {
      const emailCampaignConnectionResult = await this.connectApiCall();
      return emailCampaignConnectionResult;
    } catch (e) {
      if (e?.response?.status === 405) {
        return true;
      }

      if (e?.response?.status === 500) {
        logger.error(e?.response?.message);
        throw new InternalServerError(
          ERROR_CODES.MISSING_PROPERTIES_CAMPAIGN_MAIL_ID
        );
      }

      if (e?.response?.status === 503) {
        throw new InternalServerError(ERROR_CODES.IP_ADDRESS_IS_NOT_ALLOWED);
      }

      logger.error(e?.response?.message);
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

  async updateCampaignMailApi(data) {
    return axios.post(`${config.dscUrl}/`, data, this.getOptionsInformation());
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

      if (!createCampaignApiResult?.id) {
        throw new InternalServerError(ERROR_CODES.MALFORMAT_ESP_RESPONSE);
      }

      return createCampaignApiResult?.id;
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

      const updateCampaignApiResult = await this.updateCampaignMailApi(
        emailCampaignsData
      );

      if (!updateCampaignApiResult?.id) {
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
        mailDscId,
      } = campaignMailData;

      return {
        id: mailDscId,
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
