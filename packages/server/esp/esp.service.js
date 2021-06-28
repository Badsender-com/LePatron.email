const ERROR_CODES = require('../constant/error-codes');
const { InternalServerError } = require('http-errors');
const EspTypes = require('../constant/esp-type');
const SendinBlueProvider = require('../esp/sendinBlueProvider');
const ActitoProvider = require('../esp/actitoProvider');

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

  async getCampaignMail(campaignMail) {
    this.validateProviderInstance();
    return await this.providerInstance.getCampaignMail(campaignMail);
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
