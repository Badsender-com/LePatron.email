'use_strict';
const logger = require('../../utils/logger.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const config = require('../../node.config.js');
const axios = require('../../config/axios');
const { InternalServerError, Conflict, BadRequest } = require('http-errors');
const soapRequest = require('../../../server/utils/soap-request');

class AdobeProvider {
  constructor({ apiKey, ...data }) {
    this.apiKey = apiKey;
    this.data = data;
  }

  async connectApiCall() {
    return axios.get(`${config.adobeImsUrl}/ims/token/v3`, {
      headers: {
        apiKey: this.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async connectApi() {
    try {
      console.log('ADOBE CONNECT API');
      const emailCampaignConnectionResult = await this.connectApiCall();
      return emailCampaignConnectionResult;
    } catch (e) {
      logger.error({ errorResponseData: e?.response?.data });
      if (e?.response?.status === 405) {
        return true;
      }

      if (e?.response?.status === 500) {
        logger.error({ errorMessage: e?.response?.data?.message });
        throw new InternalServerError(ERROR_CODES.UNEXPECTED_SERVER_ERROR);
      }

      if (e?.response?.status === 503) {
        throw new InternalServerError(
          ERROR_CODES.IP_ADDRESS_IS_NOT_ALLOWED_OR_WRONG_KEY
        );
      }

      logger.error({ Error: e?.response?.data?.message });
      throw e;
    }
  }

  handleError(error) {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;

    if (status === 400) {
      throw new BadRequest(message);
    }

    if (status === 409) {
      throw new Conflict(message);
    }

    // Log the error and throw a generic error if it doesn't match specific cases
    logger.error('Error in API call:', error);
    throw new Error('An error occurred while communicating with the API.');
  }

  async getUserGroups({ user }) {
    const username = config.isDev
      ? 'olivier.fredon.ext@clarins.com'
      : user.name;

    // TODO: mocked data, use the real one from db
    const accessToken = '';

    return soapRequest({
      url: config.adobeSoapRouterUrl,
      token: accessToken,
      soapAction: 'xtk:queryDef#ExecuteQuery',
      xmlBodyRequest: `
        <ExecuteQuery
          xmlns="urn:xtk:queryDef">
          <sessiontoken></sessiontoken>
          <entity>
            <queryDef schema="xtk:operatorGroup" operation="select">
              <select>
                <node expr="[group/@name]"/>
              </select>
              <where>
                <condition expr="[operator/@name]='${username}'"/>
              </where>
            </queryDef>
          </entity>
        </ExecuteQuery>
      `,
      formatResponseFn: (response) => {
        const body = response['SOAP-ENV:Envelope']['SOAP-ENV:Body'];
        const operatorGroupCollection =
          body.ExecuteQueryResponse.pdomOutput['operatorGroup-collection'];

        return operatorGroupCollection.operatorGroup.map(
          (operatorGroup) => operatorGroup.group.name
        );
      },
    });
  }

  async getFoldersFromGroupNames({ groupNames = [] }) {
    // TODO: mocked data, use the real one from db
    const accessToken = '';

    return soapRequest({
      url: config.adobeSoapRouterUrl,
      token: accessToken,
      soapAction: 'xtk:queryDef#ExecuteQuery',
      xmlBodyRequest: `
        <ExecuteQuery xmlns="urn:xtk:queryDef">
          <sessiontoken></sessiontoken>
          <entity>
              <queryDef schema="xtk:rights" operation="select">
                  <select>
                      <node expr="[folder/@fullName]" />
                      <node expr="[folder/@name]" />
                  </select>
                  <where>
                      <condition expr="[operator/@name] IN (${groupNames.join(
                        ','
                      )})" />
                      <condition expr="@rights like '%write%'" />
                      <condition expr="[folder/@model]='nmsDeliveryModel'" />
                  </where>
              </queryDef>
          </entity>
        </ExecuteQuery>
      `,
      formatResponseFn: (response) => {
        const body = response['SOAP-ENV:Envelope']['SOAP-ENV:Body'];
        const rightsCollection =
          body.ExecuteQueryResponse.pdomOutput['rights-collection'];

        return rightsCollection.rights.map((right) => ({
          fullName: right.folder.fullName,
          name: right.folder.name,
        }));
      },
    });
  }

  async getDeliveriesFromFolderName({ folderName }) {
    // TODO: mocked data, use the real one from db
    const accessToken = '';

    return soapRequest({
      url: config.adobeSoapRouterUrl,
      token: accessToken,
      soapAction: 'xtk:queryDef#ExecuteQuery',
      xmlBodyRequest: `
        <ExecuteQuery
          xmlns="urn:xtk:queryDef">
          <sessiontoken></sessiontoken>
          <entity>
            <queryDef schema="nms:delivery" operation="select">
              <select>
                <node expr="@id"/>
                <node expr="@label"/>
                <node expr="@internalName"/>
              </select>
              <where>
                <condition expr="@name='${folderName}'"/>
              </where>
            </queryDef>
          </entity>
        </ExecuteQuery>
      `,
      formatResponseFn: (response) => {
        const body = response['SOAP-ENV:Envelope']['SOAP-ENV:Body'];
        const deliveryCollection =
          body.ExecuteQueryResponse.pdomOutput['delivery-collection'];

        return deliveryCollection.delivery.map((delivery) => ({
          id: delivery.id,
          label: delivery.label,
          externalName: delivery.externalName,
        }));
      },
    });
  }

  async saveDeliveryTemplate({ deliveryLabel, folderName, contentHtml }) {
    // TODO: mocked data, use the real one from db
    const accessToken = '';

    return soapRequest({
      url: config.adobeSoapRouterUrl,
      token: accessToken,
      soapAction: 'xtk:persist#Write',
      xmlBodyRequest: `
        <m:Write xmlns:m="urn:xtk:persist|xtk:session">
          <sessiontoken></sessiontoken>
          <domDoc xsi:type='ns:Element'>
            <delivery xtkschema="nms:delivery" isModel="1" deliveryMode="4" label="${deliveryLabel}">
              <content>
                <html>
                  <source>
                    <![CDATA[
                      ${contentHtml}
                    ]]>
                  </source>
                </html>
              </content>
              <folder name="${folderName}" />
            </delivery>
          </domDoc>
        </m:Write>
      `,
    });
  }

  async uploadDeliveryImage({ image }) {
    // TODO: mocked data, use the real one from db
    const accessToken = '';

    const form = new FormData();

    form.append('file_noMd5', image);

    try {
      const response = await axios.post(config.adobeImgUrl, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log('Response upload image delivery: ', response.data);
    } catch (err) {
      console.error(
        'Error while uploading delivery image:',
        err.response?.data || err.message
      );
    }
  }

  async saveDeliveryImage({ imageMd5, imageName }) {
    // TODO: mocked data, use the real one from db
    const accessToken = '';

    return soapRequest({
      url: config.adobeSoapRouterUrl,
      token: accessToken,
      soapAction: 'xtk:persist#Write',
      xmlBodyRequest: `
        <m:Write xmlns:m="urn:xtk:persist|xtk:session">
         <sessiontoken></sessiontoken>
          <document>
            <fileRes-collection xtkschema="xtk:fileRes">
              <fileRes
                md5="${imageMd5}"
                label="${imageName}"
                fileName="${imageName}"
                originalName="${imageName}"
                useMd5AsFilename="1"
                storageType="5"
              />
            </fileRes-collection>
          </document>
        </m:Write>
      `,
    });
  }

  async publishDeliveryImage({ imageMd5, imageName }) {
    // TODO: mocked data, use the real one from db
    const accessToken = '';

    return soapRequest({
      url: config.adobeSoapRouterUrl,
      token: accessToken,
      soapAction: 'xtk:fileRes#PublishIfNeeded',
      xmlBodyRequest: `
        <m:PublishIfNeeded xmlns:m="urn:xtk:fileRes">
         <sessiontoken></sessiontoken>
          <document>
            <fileRes
              md5="${imageMd5}"
              label="${imageName}"
              fileName="${imageName}"
              originalName="${imageName}"
              useMd5AsFilename="1"
              storageType="5"
            />
          </document>
        </m:PublishIfNeeded>
      `,
    });
  }

  async validateToken() {
    // TODO: mocked data, use the real one from db
    const accessToken = '';

    const form = new FormData();

    form.append('type', 'access_token');
    form.append('client_id', 'exc_app');
    form.append('token', accessToken);

    try {
      const response = await axios.post(
        `${config.adobeImsUrl}/ims/validate_token/v1`,
        form,
        {
          headers: {
            ...form.getHeaders(),
          },
        }
      );

      console.log('Response validate token', response.data);
    } catch (err) {
      console.error(
        'Error while validating token',
        err.response?.data || err.message
      );
    }
  }

  static async build(initialData) {
    return new AdobeProvider(initialData);
  }
}
module.exports = AdobeProvider;
