'use_strict';
const logger = require('../../utils/logger.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const config = require('../../node.config.js');
const axios = require('../../config/axios');
const { InternalServerError } = require('http-errors');
const qs = require('qs');

class AdobeProvider {
  constructor({ apiKey, secretKey, ...data }) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.data = data;
  }

  static async build(initialData) {
    return new AdobeProvider(initialData);
  }

  async connectApiCall() {
    const data = qs.stringify({
      client_id: this.apiKey,
      client_secret: this.secretKey,
      grant_type: 'client_credentials',
      scope:
        'AdobeID,openid,read_organizations,additional_info.projectedProductContext,additional_info.roles,adobeio_api,read_client_secret,manage_client_secrets,campaign_sdk,campaign_config_server_general,deliverability_service_general',
    });

    return axios.post(`${config.adobeUrl}`, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  async connectApi() {
    try {
      console.log('ADOBE CONNECT API');
      const emailCampaignConnectionResult = await this.connectApiCall();
      return emailCampaignConnectionResult;
    } catch (e) {
      logger.error({ errorResponseData: e?.response?.data });

      if (e?.response?.status === 500) {
        logger.error({ errorMessage: e?.response?.data?.message });
        throw new InternalServerError(ERROR_CODES.UNEXPECTED_SERVER_ERROR);
      }

      logger.error({ Error: e?.response?.data?.message });
      throw e;
    }
  }
}
module.exports = AdobeProvider;
