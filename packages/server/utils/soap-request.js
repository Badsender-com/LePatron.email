const axios = require('../../server/config/axios');
const { XMLParser } = require('fast-xml-parser');
const { InternalServerError } = require('http-errors');
const { createLog } = require('../../server/log/log.service');

async function soapRequest({
  userId,
  url,
  token,
  soapAction,
  xmlBodyRequest,
  formatResponseFn = (response) => response,
  shouldRetry = true,
  refreshTokenFn = (response) => response,
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
    const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
    const jsObjectFromXml = parser.parse(response.data);

    const errorFromAdobe =
      jsObjectFromXml['SOAP-ENV:Envelope']['SOAP-ENV:Body']['SOAP-ENV:Fault'];

    if (errorFromAdobe) {
      const detail = errorFromAdobe.detail?.$t || '';

      // If we get a 401 response, we try to refresh the token and perform the request again
      if (
        shouldRetry &&
        typeof detail === 'string' &&
        detail.includes('HTTP response code is 401')
      ) {
        const newToken = await refreshTokenFn();
        return soapRequest({
          userId,
          url,
          token: newToken,
          soapAction,
          xmlBodyRequest,
          formatResponseFn,
          shouldRetry: false,
          refreshTokenFn,
        });
      }

      throw new InternalServerError(detail || 'SOAP Fault');
    }

    return formatResponseFn(jsObjectFromXml);
  } catch (error) {
    const { response } = error;

    const log = await createLog(
      {
        query: xml,
        responseStatus: response?.status || 500,
        response: JSON.stringify(response?.data || error),
      },
      userId
    );

    error.logId = log?.id;
    throw error;
  }
}

module.exports = soapRequest;
