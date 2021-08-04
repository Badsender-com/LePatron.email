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
    this.validateProviderInstance();
    return await this.providerInstance.createTemplate(campaignTemplate);
  }

  async getCampaignMail(campaignMail) {
    this.validateProviderInstance();
    return await this.providerInstance.getCampaignMail(campaignMail);
  }

  async getTemplate(campaignTemplate) {
    this.validateProviderInstance();
    return await this.providerInstance.getTemplate(campaignTemplate);
  }

  async updateCampaignMail(campaignMail) {
    this.validateProviderInstance();
    return await this.providerInstance.updateCampaignMail(campaignMail);
  }

  async updateTemplate(campaignTemplate) {
    this.validateProviderInstance();
    return await this.providerInstance.updateTemplate(campaignTemplate);
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
