'use_strict';
const logger = require('../../utils/logger');

const mailingService = require('../../mailing/mailing.service.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const axios = require('axios');

const { InternalServerError } = require('http-errors');
const archiver = require('archiver');
const API3_ACTITO_V4 = 'https://api3.actito.com/v4';
const API_AUTHENTIFICATION = 'https://api.actito.com/auth/token';

class ActitoProvider {
  constructor({ apiKey, ...data }) {
    this.apiKey = apiKey;
    this.data = data;
    this.accessDataFromApi = null;
  }

  async connectApi() {
    return await axios.get(API_AUTHENTIFICATION, {
      headers: { Authorization: this.apiKey, Accept: 'application/json' },
    });
  }

  async getHeaderAccessToken(connectApiData) {
    if (!connectApiData || !connectApiData.accessToken) {
      throw new InternalServerError(ERROR_CODES.MALFORMAT_ESP_RESPONSE);
    }

    return {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    };
  }

  async getAllEspEntities() {
    const headerAccess = await this.getHeaderAccess();
    return await axios.get(`${API3_ACTITO_V4}/entity`, headerAccess);
  }

  async getAllEspProfileTableName({ entity }) {
    const headerAccess = await this.getHeaderAccess();
    return await axios.get(`${API3_ACTITO_V4}/${entity}/table/ `, headerAccess);
  }

  async getHeaderAccess() {
    try {
      if (!this.accessDataFromApi) {
        this.accessDataFromApi = await this.connectApi();
      }

      return this.getHeaderAccessToken(this.accessDataFromApi);
    } catch (e) {
      logger.error(e.response.text);
      throw e;
    }
  }

  async getCampaignMail({ campaignId, entity }) {
    if (!campaignId) {
      throw new InternalServerError(
        ERROR_CODES.MISSING_PROPERTIES_CAMPAIGN_MAIL_ID
      );
    }

    if (!entity) {
      throw new InternalServerError(ERROR_CODES.MISSING_PROPERTIES_ENTITY);
    }

    const headerAccess = await this.getHeaderAccess();
    const apiEmailCampaignResult = await axios.get(
      `${API3_ACTITO_V4}/${entity}/mail/${campaignId} `,
      headerAccess
    );

    return {
      name: apiEmailCampaignResult?.name,
      additionalApiData: {
        from: apiEmailCampaignResult?.from,
        replyTo: apiEmailCampaignResult?.replyTo,
      },
    };
  }

  async setCampaignHtmlMail({ campaignId, entity }) {
    if (!campaignId) {
      throw new InternalServerError(
        ERROR_CODES.MISSING_PROPERTIES_CAMPAIGN_MAIL_ID
      );
    }

    if (!entity) {
      throw new InternalServerError(ERROR_CODES.MISSING_PROPERTIES_ENTITY);
    }

    const headerAccess = await this.getHeaderAccess();
    return await axios.post(
      `${API3_ACTITO_V4}/${entity}/mail/${campaignId}/content/body`,
      headerAccess
    );
  }

  async createCampaignMail({ campaignMailData, user, mailingId }) {
    return await this.formatSendinBlueData({
      campaignMailData,
      user,
      mailingId,
    });
  }

  async formatSendinBlueData({ user, html, mailingId }) {
    try {
      const archive = archiver('zip');
      const downloadOptions = { forCdn: false, forFtp: false };
      const { archive: processedArchive } = await mailingService.downloadZip({
        user,
        html,
        archive,
        downloadOptions,
        mailingId,
      });

      archive.on('error', () => {
        throw new InternalServerError(
          ERROR_CODES.UNEXPECTED_ERROR_WHILE_ARCHIVING_PROCESSED_HTML
        );
      });
      archive.on('end', () => {
        console.log(`Archive wrote ${archive.pointer()} bytes`);
      });
      processedArchive.finalize();
    } catch (e) {
      throw new InternalServerError(
        ERROR_CODES.UNEXPECTED_ERROR_WHILE_ARCHIVING_PROCESSED_HTML
      );
    }
  }
}

module.exports = ActitoProvider;
