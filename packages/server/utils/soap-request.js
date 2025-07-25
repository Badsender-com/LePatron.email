const axios = require('../../server/config/axios');
const xmlParser = require('xml2json');

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

    const formatedResponse = formatResponseFn(jsObjectFromXml);

    console.log('Formated SOAP Response:', formatedResponse);

    return formatedResponse;
  } catch (error) {
    console.error('SOAP Error:', error);
  }
}

module.exports = soapRequest;
