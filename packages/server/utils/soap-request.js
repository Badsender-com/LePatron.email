const axios = require('../../server/config/axios');
const xmlParser = require('xml2json');
const { InternalServerError } = require('http-errors');
const { createLog } = require('../../server/log/log.service');

async function soapRequest({
  userId,
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
      throw new InternalServerError(errorFromAdobe);
    }

    return formatResponseFn(jsObjectFromXml);
  } catch (error) {
    const { response } = error;
    console.error('SOAP Error:', error);

    await createLog(
      {
        query: xml,
        responseStatus: response?.status || 500,
        response: JSON.stringify(response?.data || error),
      },
      userId
    );

    throw error;
  }
}

module.exports = soapRequest;
