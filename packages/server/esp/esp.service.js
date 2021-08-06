const ERROR_CODES = require('../constant/error-codes');
const { InternalServerError } = require('http-errors');
const EspTypes = require('../constant/esp-type');
const SendinBlueProvider = require('../esp/sendinblue/sendinBlueProvider');
const ActitoProvider = require('../esp/actito/actitoProvider');

class EspService {
  constructor({
    type = EspTypes.SENDINBLUE,
    apiKey,
    _company,
    additionalApiData,
  }) {
    this.authorisedEsps = [EspTypes.ACTITO, EspTypes.SENDINBLUE];
    if (!this.authorisedEsps.includes(type)) {
      throw new InternalServerError(ERROR_CODES.UNAUTHORIZED_ESP);
    }
    this.settings = {
      type,
      apiKey,
    };

    this.providerInstance = this.createEsp(additionalApiData);
    this.validateProviderInstance();
  }

  createEsp(data) {
    switch (this?.settings?.type) {
      case EspTypes.SENDINBLUE:
        return new SendinBlueProvider({
          apiKey: this?.settings?.apiKey,
          data,
        });
      case EspTypes.ACTITO:
        return new ActitoProvider({
          apiKey: this?.settings?.apiKey,
          data,
        });
      default:
        throw new InternalServerError(ERROR_CODES.UNAUTHORIZED_ESP);
    }
  }

  async connectApi() {
    this.validateProviderInstance();
    return await this.providerInstance.connectApi();
  }

  async createCampaignMail(sendingMailData) {
    this.validateProviderInstance();
    return await this.providerInstance.createCampaignMail(sendingMailData);
  }

  async createTemplate(campaignTemplate) {
    if (this?.settings?.type === EspTypes.SENDINBLUE) {
      this.validateProviderInstance();
      return await this.providerInstance.createTemplate(campaignTemplate);
    } else {
      throw new InternalServerError(
        ERROR_CODES.UNAUTHORIZED_METHOD_CALL_ON_SENDINBLUE_PROVIDER
      );
    }
  }

  async getCampaignMail(campaignMail) {
    this.validateProviderInstance();
    return await this.providerInstance.getCampaignMail(campaignMail);
  }

  async getTemplate(campaignTemplate) {
    if (this?.settings?.type === EspTypes.SENDINBLUE) {
      this.validateProviderInstance();
      return await this.providerInstance.getTemplate(campaignTemplate);
    } else {
      throw new InternalServerError(
        ERROR_CODES.UNAUTHORIZED_METHOD_CALL_ON_SENDINBLUE_PROVIDER
      );
    }
  }

  async updateCampaignMail(campaignMail) {
    this.validateProviderInstance();
    return await this.providerInstance.updateCampaignMail(campaignMail);
  }

  async updateTemplate(campaignTemplate) {
    if (this?.settings?.type === EspTypes.SENDINBLUE) {
      this.validateProviderInstance();
      return await this.providerInstance.updateTemplate(campaignTemplate);
    } else {
      throw new InternalServerError(
        ERROR_CODES.UNAUTHORIZED_METHOD_CALL_ON_SENDINBLUE_PROVIDER
      );
    }
  }

  async getAllEspEntities() {
    if (this?.settings?.type === EspTypes.ACTITO) {
      this.validateProviderInstance();
      return await this.providerInstance.getAllEspEntities();
    } else {
      throw new InternalServerError(
        ERROR_CODES.UNAUTHORIZED_METHOD_CALL_ON_SENDINBLUE_PROVIDER
      );
    }
  }

  async getAllEspProfileTableName(getAllEspProfileTableData) {
    if (this?.settings?.type === EspTypes.ACTITO) {
      this.validateProviderInstance();
      return await this.providerInstance.getAllEspProfileTableName(
        getAllEspProfileTableData
      );
    } else {
      throw new InternalServerError(
        ERROR_CODES.UNAUTHORIZED_METHOD_CALL_ON_SENDINBLUE_PROVIDER
      );
    }
  }

  validateProviderInstance() {
    if (typeof this.providerInstance === 'undefined') {
      throw new InternalServerError(
        ERROR_CODES.ESP_PROVIDER_INSTANCE_NOT_DEFINED
      );
    }
  }
}

module.exports = EspService;
