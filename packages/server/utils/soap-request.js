const axios = require('../../server/config/axios');
const xmlParser = require('xml2json');
const { InternalServerError } = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');

async function soapRequest({
  url,
  token,
  soapAction,
  xmlBodyRequest,
  formatResponseFn = (response) => response,
}) {
  const xml = `
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        ${xmlBodyRequest}
      </soap:Body>
    </soap:Envelope>
  `;

  try {
    const response = await axios.post(url, xml, {
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        Authorization: `Bearer ${token}`,
        SOAPAction: soapAction,
      },
    });
    const jsObjectFromXml = JSON.parse(xmlParser.toJson(response.data));

    const errorFromAdobe =
      jsObjectFromXml['SOAP-ENV:Envelope']['SOAP-ENV:Body']['SOAP-ENV:Fault'];

    if (errorFromAdobe) {
      console.error(errorFromAdobe);
      throw new InternalServerError(ERROR_CODES.UNEXPECTED_SERVER_ERROR);
    }

    return formatResponseFn(jsObjectFromXml);
  } catch (error) {
    console.error('SOAP Error:', error);
  }
}

module.exports = soapRequest;
