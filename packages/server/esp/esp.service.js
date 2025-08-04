const ERROR_CODES = require('../constant/error-codes');
const { InternalServerError } = require('http-errors');
const EspTypes = require('../constant/esp-type');
const SendinBlueProvider = require('../esp/sendinblue/sendinBlueProvider');
const ActitoProvider = require('../esp/actito/actitoProvider');
const DscProvider = require('./dsc/dscProvider');
const AdobeProvider = require('./adobe/adobeProvider');

class EspService {
  static async build({
    type,
    apiKey,
    secretKey,
    accessToken,
    profileId,
    userId,
    additionalApiData,
  }) {
    const authorizedEsps = [
      EspTypes.ACTITO,
      EspTypes.SENDINBLUE,
      EspTypes.DSC,
      EspTypes.ADOBE,
    ];
    if (!authorizedEsps.includes(type)) {
      throw new InternalServerError(ERROR_CODES.UNAUTHORIZED_ESP);
    }

    switch (type) {
      case EspTypes.SENDINBLUE:
        return SendinBlueProvider.build({
          apiKey: apiKey,
          data: additionalApiData,
        });
      case EspTypes.ACTITO:
        return ActitoProvider.build({
          apiKey: apiKey,
          data: additionalApiData,
        });
      case EspTypes.DSC:
        return DscProvider.build({
          apiKey: apiKey,
          data: additionalApiData,
        });
      case EspTypes.ADOBE:
        return AdobeProvider.build({
          apiKey: apiKey,
          secretKey: secretKey,
          accessToken: accessToken,
          profileId: profileId,
          userId: userId,
          data: additionalApiData,
        });
      default:
        throw new InternalServerError(ERROR_CODES.UNAUTHORIZED_ESP);
    }
  }
}

module.exports = EspService;
