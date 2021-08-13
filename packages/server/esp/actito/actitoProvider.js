'use_strict';

const logger = require('../../utils/logger');
const mailingService = require('../../mailing/mailing.service.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const axios = require('axios');
const FormData = require('form-data');
const archiver = require('archiver');
const { InternalServerError } = require('http-errors');

// const API_ACTITO_V4 = 'api.actito.com/v4';
const API3_ACTITO = 'https://api3.actito.com';
const API3_ACTITO_V4 = API3_ACTITO + '/v4';
const API_AUTHENTIFICATION = API3_ACTITO + '/auth/token';

class ActitoProvider {
  constructor({ apiKey, ...data }) {
    this.apiKey = apiKey;
    this.data = data;
    this.accessDataFromApi = null;
  }

  async connectApi() {
    console.log({ apiKeyFromConnectApi: this.apiKey });
    return await axios.get(API_AUTHENTIFICATION, {
      headers: { Authorization: this.apiKey, Accept: 'application/json' },
    });
  }

  async getHeaderAccessToken(connectApiData) {
    console.log({ connectApiData });
    if (
      !connectApiData ||
      !connectApiData.data ||
      !connectApiData.data.accessToken
    ) {
      throw new InternalServerError(ERROR_CODES.MALFORMAT_ESP_RESPONSE);
    }

    return {
      headers: {
        Authorization: `Bearer ${connectApiData.data.accessToken}`,
        Accept: 'application/json',
      },
    };
  }

  async getAllEspEntities() {
    const headerAccess = await this.getHeaderAccess();
    const allEntitesResult = await axios.get(
      `${API3_ACTITO_V4}/entity`,
      headerAccess
    );

    return allEntitesResult?.data;
  }

  async getAllEspProfileTableName({ entity }) {
    const headerAccess = await this.getHeaderAccess();

    const allEspProfileTableResult = await axios.get(
      `${API3_ACTITO_V4}/entity/${entity}/table/ `,
      headerAccess
    );
    return allEspProfileTableResult?.data;
  }

  async getHeaderAccess() {
    try {
      if (!this.accessDataFromApi) {
        this.accessDataFromApi = await this.connectApi();
      }

      return this.getHeaderAccessToken(this.accessDataFromApi);
    } catch (e) {
      console.log(e);
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
      `${API3_ACTITO_V4}/entity/${entity}/mail/${campaignId}`,
      headerAccess
    );

    const mailSubjectResult = await this.getCampaignMailSubjectLine({
      campaignId,
      entity,
    });

    return {
      name: apiEmailCampaignResult?.name,
      additionalApiData: {
        from: apiEmailCampaignResult?.from,
        replyTo: apiEmailCampaignResult?.replyTo,
        subject: mailSubjectResult?.subject,
        entityOfTarget: apiEmailCampaignResult?.entityOfTarget,
        supportedLanguages: apiEmailCampaignResult?.supportedLanguages,
        targetTable: apiEmailCampaignResult?.targetTable,
        encoding: apiEmailCampaignResult?.encoding,
      },
    };
  }

  async setCampaignHtmlMail({ archive, campaignId, entity }) {
    const form = new FormData();
    form.append('inputForm', archive);
    this.checkIfCampaignIdAndEntityExists({ campaignId, entity });
    const headerAccess = await this.getHeaderAccess();
    return await axios.post(
      `${API3_ACTITO_V4}/entity/${entity}/mail/${campaignId}/content/body`,
      form,
      { headers: { ...headerAccess, ...form.getHeaders() } }
    );
  }

  async getCampaignHtmlMail({ campaignId, entity }) {
    this.checkIfCampaignIdAndEntityExists({ campaignId, entity });
    const headerAccess = await this.getHeaderAccess();
    return await axios.get(
      `${API3_ACTITO_V4}/entity/${entity}/mail/${campaignId}/content/body`,
      { headers: headerAccess }
    );
  }

  async setCampaignMailSubjectLine({ subject, campaignId, entity }) {
    this.checkIfCampaignIdAndEntityExists({ campaignId, entity });
    const headerAccess = await this.getHeaderAccess();
    return await axios.post(
      `${API3_ACTITO_V4}/entity/${entity}/mail/${campaignId}/content/subject`,
      subject,
      { headers: headerAccess }
    );
  }

  async getCampaignMailSubjectLine({ campaignId, entity }) {
    this.checkIfCampaignIdAndEntityExists({ campaignId, entity });
    const headerAccess = await this.getHeaderAccess();
    return await axios.get(
      `${API3_ACTITO_V4}/entity/${entity}/mail/${campaignId}/content/subject`,
      { headers: headerAccess }
    );
  }

  checkIfCampaignIdAndEntityExists({ campaignId, entity }) {
    if (!campaignId) {
      throw new InternalServerError(
        ERROR_CODES.MISSING_PROPERTIES_CAMPAIGN_MAIL_ID
      );
    }

    if (!entity) {
      throw new InternalServerError(ERROR_CODES.MISSING_PROPERTIES_ENTITY);
    }
  }

  async createCampaignMail({
    campaignMailData,
    html,
    user,
    mailingId,
    entity,
  }) {
    const headerAccess = await this.getHeaderAccess();

    return await this.saveCampaignMail({
      campaignMailData,
      html,
      user,
      mailingId,
      entity,
      mailCampaignApi: async (data) =>
        axios.post(`${API3_ACTITO_V4}/entity/${entity}/mail/`, data, {
          headers: headerAccess,
        }),
    });
  }

  async updateCampaignMail({
    campaignMailData,
    html,
    user,
    mailingId,
    entity,
  }) {
    const headerAccess = await this.getHeaderAccess();

    return await this.saveCampaignMail({
      campaignMailData,
      html,
      user,
      mailingId,
      entity,
      mailCampaignApi: async (data) =>
        axios.put(`${API3_ACTITO_V4}/entity/${entity}/mail/`, data, {
          headers: headerAccess,
        }),
    });
  }

  async saveCampaignMail({
    campaignMailData,
    html,
    user,
    mailingId,
    entity,
    mailCampaignApi,
  }) {
    if (typeof mailCampaignApi !== 'function') {
      throw new InternalServerError(ERROR_CODES.API_CALL_IS_NOT_A_FUNCTION);
    }

    const {
      from,
      entityOfTarget,
      supportedLanguages,
      name,
      replyTo,
      targetTable,
      encoding,
      processedArchive,
      subject,
    } = await this.formatActitoData({
      campaignMailData,
      html,
      user,
      mailingId,
    });

    const createdCampaignMailResult = await mailCampaignApi({
      from,
      entityOfTarget,
      supportedLanguages,
      name,
      replyTo,
      targetTable,
      encoding,
    });

    if (!createdCampaignMailResult?.campaignId) {
      throw new InternalServerError(ERROR_CODES.UNEXPECTED_ESP_RESPONSE);
    }

    const campaignHtmlMailResult = await this.setCampaignHtmlMail({
      archive: processedArchive,
      campaignId: createdCampaignMailResult?.campaignId,
      entity,
    });

    this.checkIfCampaignIdIsDefined(campaignHtmlMailResult);

    const campaignSubjectMailResult = await this.setCampaignMailSubjectLine({
      subject,
      campaignId: createdCampaignMailResult?.campaignId,
      entity,
    });

    this.checkIfCampaignIdIsDefined(campaignSubjectMailResult);

    return {
      id: createdCampaignMailResult?.campaignId,
      from,
      entityOfTarget,
      supportedLanguages,
      name,
      replyTo,
      targetTable,
      encoding,
      subject,
    };
  }

  async formatActitoData({ campaignMailData, user, html, mailingId }) {
    try {
      const archive = archiver('zip');
      const downloadOptions = { forCdn: false, forFtp: true };
      const { archive: processedArchive } = await mailingService.downloadZip({
        user,
        html,
        archive,
        downloadOptions,
        mailingId,
      });

      const {
        from,
        entityOfTarget,
        supportedLanguages,
        name,
        replyTo,
        targetTable,
        encoding,
        subject,
      } = campaignMailData;

      processedArchive.on('error', () => {
        throw new InternalServerError(
          ERROR_CODES.UNEXPECTED_ERROR_WHILE_ARCHIVING_PROCESSED_HTML
        );
      });

      processedArchive.on('end', () => {
        console.log(`Archive wrote ${archive.pointer()} bytes`);
      });

      await processedArchive.finalize();

      return {
        from,
        entityOfTarget,
        supportedLanguages,
        name,
        replyTo,
        targetTable,
        encoding,
        subject,
        processedArchive,
      };
    } catch (e) {
      throw new InternalServerError(
        ERROR_CODES.UNEXPECTED_ERROR_WHILE_ARCHIVING_PROCESSED_HTML
      );
    }
  }

  checkIfCampaignIdIsDefined(campaignData) {
    if (!campaignData?.campaignId) {
      throw new InternalServerError(ERROR_CODES.UNEXPECTED_ESP_RESPONSE);
    }
  }
}

module.exports = ActitoProvider;
