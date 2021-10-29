'use_strict';

const logger = require('../../utils/logger');
const mailingService = require('../../mailing/mailing.service.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const axios = require('axios');
const FormData = require('form-data');
const archiver = require('archiver');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const { Conflict, InternalServerError } = require('http-errors');

const possibleApiDomaineToCall = ['api', 'api1', 'api3'];

class ActitoProvider {
  constructor({ apiKey, validBaseApi, ...data }) {
    this.apiKey = apiKey;
    this.data = data;
    this.accessDataFromApi = null;

    this.validBaseApi = validBaseApi;
  }

  static async build({ apiKey, ...initialData }) {
    let i = 0;
    let validBaseApi = null;

    do {
      const currentIndex = i;
      i++;
      try {
        const apiUrl = ActitoProvider.getActitoApiUrl(
          possibleApiDomaineToCall[currentIndex]
        );
        logger.log('attempt connect api ', apiUrl);

        const connection = await this.connectApiWithoutsApiBase(apiUrl, apiKey);

        if (connection) {
          logger.log('Valid base api, Yes!', validBaseApi);
          validBaseApi = possibleApiDomaineToCall[currentIndex];
        }
      } catch (error) {
        logger.error(error);
      }
    } while (!validBaseApi && i < possibleApiDomaineToCall.length);

    if (!validBaseApi) {
      throw new InternalServerError(ERROR_CODES.UNDEFINED_ACTITO_BASE_API_URL);
    }

    return new ActitoProvider({ apiKey, validBaseApi, ...initialData });
  }

  static getActitoApiUrl(baseApi) {
    return `https://${baseApi}.actito.com`;
  }

  static async connectApiWithoutsApiBase(url, apiKey) {
    return axios.get(`${url}/auth/token`, {
      headers: { Authorization: apiKey, Accept: 'application/json' },
    });
  }

  getActitoUrl() {
    if (
      !this.validBaseApi ||
      !possibleApiDomaineToCall.includes(this.validBaseApi)
    ) {
      throw new InternalServerError(ERROR_CODES.UNDEFINED_ACTITO_BASE_API_URL);
    }

    return `${ActitoProvider.getActitoApiUrl(this.validBaseApi)}`;
  }

  getV4ActitoUrl() {
    return `${this.getActitoUrl()}/v4`;
  }

  async connectApi() {
    return axios.get(`${this.getActitoUrl()}/auth/token`, {
      headers: { Authorization: this.apiKey, Accept: 'application/json' },
    });
  }

  async getHeaderAccessToken(connectApiData) {
    if (
      !connectApiData ||
      !connectApiData.data ||
      !connectApiData.data.accessToken
    ) {
      throw new InternalServerError(ERROR_CODES.MALFORMAT_ESP_RESPONSE);
    }

    return {
      Authorization: `Bearer ${connectApiData.data.accessToken}`,
      Accept: 'application/json',
    };
  }

  async getAllEspEntities() {
    try {
      const headerAccess = await this.getHeaderAccess();
      const allEntitesResult = await axios.get(
        `${this.getV4ActitoUrl()}/entity`,
        {
          headers: headerAccess,
        }
      );

      return allEntitesResult?.data;
    } catch (e) {
      logger.error(e.response);
      throw e;
    }
  }

  async getAllEspProfileTableName({ entity }) {
    try {
      const headerAccess = await this.getHeaderAccess();

      const allEspProfileTableResult = await axios.get(
        `${this.getV4ActitoUrl()}/entity/${entity}/table/ `,
        { headers: headerAccess }
      );
      return allEspProfileTableResult?.data;
    } catch (e) {
      logger.error(e.response.statusText);
      throw e;
    }
  }

  async getHeaderAccess() {
    try {
      if (!this.accessDataFromApi) {
        this.accessDataFromApi = await this.connectApi();
      }

      return this.getHeaderAccessToken(this.accessDataFromApi);
    } catch (e) {
      logger.error(e.response.statusText);
      throw e;
    }
  }

  async getCampaignMail({ campaignId, entity }) {
    try {
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
        `${this.getV4ActitoUrl()}/entity/${entity}/mail/${campaignId}`,
        { headers: headerAccess }
      );

      const mailSubjectResult = await this.getCampaignMailSubjectLine({
        campaignId,
        entity,
      });

      const {
        displayName,
        from,
        replyTo,
        entityOfTarget,
        supportedLanguages,
        targetTable,
        encoding,
      } = apiEmailCampaignResult?.data;

      return {
        name: displayName,
        additionalApiData: {
          senderMail: from,
          replyTo: replyTo,
          entity: entityOfTarget,
          supportedLanguage: supportedLanguages,
          targetTable: targetTable,
          encodingType: encoding,
        },
        subject: mailSubjectResult?.data?.subject,
      };
    } catch (e) {
      logger.error(e.response.statusText);

      throw e;
    }
  }

  async setCampaignHtmlMail({ archive, campaignId, entity, archiveName }) {
    let tmpDir;
    try {
      const form = new FormData();
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), archiveName));
      const tmpZipFile = tmpDir + '/' + archiveName + '.zip';
      const headerAccess = await this.getHeaderAccess();
      const headers = {
        Authorization: headerAccess.Authorization,
        contentType: 'multipart/form-data',
        ...form.getHeaders(),
      };
      this.checkIfCampaignIdAndEntityExists({ campaignId, entity });

      archive.pipe(fs.createWriteStream(tmpZipFile));
      archive.finalize();
      logger.log('file existence', fs.existsSync(tmpZipFile));
      logger.log('file path', tmpZipFile);
      form.append('inputFile', fs.createReadStream(tmpZipFile));

      return axios.post(
        `${this.getV4ActitoUrl()}/entity/${entity}/mail/${campaignId}/content/body?charset=utf8`,
        form,
        { headers }
      );
    } catch (e) {
      logger.error(e.response.statusText);
      throw e;
    } finally {
      try {
        if (tmpDir) {
          fs.rmSync(tmpDir, { recursive: true });
        }
      } catch (e) {
        logger.error(
          `An error has occurred while removing the temp folder at ${tmpDir}. Please remove it manually. Error: ${e}`
        );
      }
    }
  }

  async getCampaignHtmlMail({ campaignId, entity }) {
    try {
      this.checkIfCampaignIdAndEntityExists({ campaignId, entity });
      const headerAccess = await this.getHeaderAccess();
      return axios.get(
        `${this.getV4ActitoUrl()}/entity/${entity}/mail/${campaignId}/content/body`,
        { headers: headerAccess }
      );
    } catch (e) {
      logger.error(e.response);
      throw e;
    }
  }

  async deleteCampaignMail({ campaignId, entity }) {
    try {
      this.checkIfCampaignIdAndEntityExists({ campaignId, entity });
      const headerAccess = await this.getHeaderAccess();
      return axios.delete(
        `${this.getV4ActitoUrl()}/entity/${entity}/mail/${campaignId}`,
        { headers: headerAccess }
      );
    } catch (e) {
      logger.error(e.response);
      throw e;
    }
  }

  async setCampaignMailSubjectLine({ subject, campaignId, entity }) {
    try {
      this.checkIfCampaignIdAndEntityExists({ campaignId, entity });
      const headerAccess = await this.getHeaderAccess();
      return axios.put(
        `${this.getV4ActitoUrl()}/entity/${entity}/mail/${campaignId}/content/subject`,
        subject,
        { headers: headerAccess }
      );
    } catch (e) {
      await this.deleteCampaignMail({ campaignId, entity });
      logger.error(e.response.statusText);
      throw e;
    }
  }

  async getCampaignMailSubjectLine({ campaignId, entity }) {
    try {
      this.checkIfCampaignIdAndEntityExists({ campaignId, entity });
      const headerAccess = await this.getHeaderAccess();
      return axios.get(
        `${this.getV4ActitoUrl()}/entity/${entity}/mail/${campaignId}/content/subject`,
        { headers: headerAccess }
      );
    } catch (e) {
      logger.error(e.response.statusText);
      throw e;
    }
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

  async createCampaignMail({ campaignMailData, html, user, mailingId }) {
    const headerAccess = await this.getHeaderAccess();

    const { entity } = campaignMailData;
    const createCampaignMailResult = await this.saveCampaignMail({
      campaignMailData,
      html,
      user,
      mailingId,
      entity,
      mailCampaignApi: async (data) =>
        axios.post(`${this.getV4ActitoUrl()}/entity/${entity}/mail/`, data, {
          headers: headerAccess,
        }),
    });

    return createCampaignMailResult?.id;
  }

  async updateCampaignMail({
    campaignMailData,
    html,
    user,
    mailingId,
    entity,
    campaignId,
  }) {
    const headerAccess = await this.getHeaderAccess();

    return this.saveCampaignMail({
      campaignMailData,
      html,
      user,
      mailingId,
      entity,
      mailCampaignApi: async (data) =>
        axios.put(
          `${this.getV4ActitoUrl()}/entity/${entity}/mail/${campaignId}`,
          data,
          {
            headers: headerAccess,
          }
        ),
      isEdit: true,
    });
  }

  async saveCampaignMail({
    campaignMailData,
    html,
    user,
    mailingId,
    entity,
    mailCampaignApi,
    isEdit = false,
  }) {
    let campaignId;

    try {
      if (typeof mailCampaignApi !== 'function') {
        throw new InternalServerError(ERROR_CODES.API_CALL_IS_NOT_A_FUNCTION);
      }

      const {
        from,
        entityOfTarget,
        supportedLanguages,
        displayName,
        replyTo,
        targetTable,
        encoding,
        processedArchive,
        subject,
        contentType,
        archiveName,
      } = await this.formatActitoData({
        campaignMailData,
        html,
        user,
        mailingId,
      });

      let mailCampaignApiData = {
        from,
        entityOfTarget,
        supportedLanguages,
        displayName,
        replyTo,
        targetTable,
        encoding,
        contentType,
      };

      if (!isEdit) {
        mailCampaignApiData = {
          ...mailCampaignApiData,
          name: displayName?.replace(/[^A-Z0-9]+/gi, '_'),
        };
      }

      const createdCampaignMailResult = await mailCampaignApi(
        mailCampaignApiData
      );

      if (!createdCampaignMailResult?.data?.campaignId) {
        throw new InternalServerError(ERROR_CODES.UNEXPECTED_ESP_RESPONSE);
      }

      campaignId = createdCampaignMailResult?.data?.campaignId;

      const campaignHtmlMailResult = await this.setCampaignHtmlMail({
        archive: processedArchive,
        campaignId: campaignId,
        archiveName,
        entity,
      });

      if (!campaignHtmlMailResult?.data?.campaignId) {
        throw new InternalServerError(ERROR_CODES.UNEXPECTED_ESP_RESPONSE);
      }

      const campaignSubjectMailResult = await this.setCampaignMailSubjectLine({
        subject,
        campaignId,
        entity,
      });

      this.checkIfCampaignIdIsDefined(campaignSubjectMailResult);

      return {
        id: campaignId,
        from,
        entityOfTarget,
        supportedLanguages,
        displayName,
        replyTo,
        targetTable,
        encoding,
        subject,
      };
    } catch (e) {
      logger.error(e?.response?.data);
      if (campaignId) {
        await this.deleteCampaignMail({ campaignId, entity });
      }

      if (e?.response?.status === 409) {
        throw new Conflict(ERROR_CODES.ALREADY_USED_MAIL_NAME);
      }

      throw e;
    }
  }

  async formatActitoData({ campaignMailData, user, html, mailingId }) {
    try {
      const archive = archiver('zip');
      const downloadOptions = {
        downLoadForCdn: 'false',
        downLoadForFtp: 'true',
      };
      const {
        archive: processedArchive,
        name: archiveName,
      } = await mailingService.downloadZip({
        user,
        html,
        archive,
        downloadOptions,
        mailingId,
      });

      const {
        senderMail: from,
        entity: entityOfTarget,
        supportedLanguage,
        name: displayName,
        replyTo,
        targetTable,
        encodingType: encoding,
        subject,
      } = campaignMailData;

      processedArchive.on('error', () => {
        throw new InternalServerError(
          ERROR_CODES.UNEXPECTED_ERROR_WHILE_ARCHIVING_PROCESSED_HTML
        );
      });

      return {
        from,
        entityOfTarget,
        supportedLanguages: [supportedLanguage],
        displayName,
        replyTo,
        targetTable,
        encoding,
        subject,
        archiveName,
        processedArchive: processedArchive,
        contentType: 'HTML',
      };
    } catch (e) {
      throw new InternalServerError(
        ERROR_CODES.UNEXPECTED_ERROR_WHILE_ARCHIVING_PROCESSED_HTML
      );
    }
  }

  checkIfCampaignIdIsDefined(campaignData) {
    if (!campaignData?.data?.campaignId) {
      throw new InternalServerError(ERROR_CODES.UNEXPECTED_ESP_RESPONSE);
    }
  }
}

module.exports = ActitoProvider;
