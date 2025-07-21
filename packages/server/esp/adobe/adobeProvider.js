'use_strict';
const logger = require('../../utils/logger.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const config = require('../../node.config.js');
const axios = require('../../config/axios');
const { InternalServerError, Conflict, BadRequest } = require('http-errors');

// TODO when more info
class AdobeProvider {
  constructor({ apiKey, ...data }) {
    this.apiKey = apiKey;
    this.data = data;
  }

  async connectApiCall() {
    return axios.get(`${config.adobeUrl}`, {
      headers: {
        apiKey: this.apiKey,
        'Content-Type': 'application/json',
        'User-Agent': config.adobeUserAgent,
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

  handleError(error) {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;

    if (status === 400) {
      throw new BadRequest(message);
    }

    if (status === 409) {
      throw new Conflict(message);
    }

    // Log the error and throw a generic error if it doesn't match specific cases
    logger.error('Error in API call:', error);
    throw new Error('An error occurred while communicating with the API.');
  }
}
module.exports = AdobeProvider;
