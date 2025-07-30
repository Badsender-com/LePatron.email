'use_strict';
const logger = require('../../utils/logger.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const config = require('../../node.config.js');
const axios = require('../../config/axios');
const { InternalServerError } = require('http-errors');
const qs = require('qs');
const soapRequest = require('../../../server/utils/soap-request');

class AdobeProvider {
  constructor({ apiKey, secretKey, accessToken, ...data }) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.accessToken = accessToken;
    this.data = data;
  }

  static async build(initialData) {
    return new AdobeProvider(initialData);
  }

  async connectApiCall() {
    const data = qs.stringify({
      client_id: this.apiKey,
      client_secret: this.secretKey,
      grant_type: 'client_credentials',
      scope:
        'AdobeID,openid,read_organizations,additional_info.projectedProductContext,additional_info.roles,adobeio_api,read_client_secret,manage_client_secrets,campaign_sdk,campaign_config_server_general,deliverability_service_general',
    });

    return axios.post(`${config.adobeImsUrl}/ims/token/v3`, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
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

      if (e?.response?.status === 500) {
        logger.error({ errorMessage: e?.response?.data?.message });
        throw new InternalServerError(ERROR_CODES.UNEXPECTED_SERVER_ERROR);
      }

      logger.error({ Error: e?.response?.data?.message });
      throw e;
    }
  }

  async getUserGroups({ user }) {
    const username = config.isDev ? config.adobeDefaultUser : user.name;

    return soapRequest({
      url: config.adobeSoapRouterUrl,
      token: this.accessToken,
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

        const operatorGroup = operatorGroupCollection.operatorGroup;
        if (operatorGroup instanceof Array) {
          return operatorGroup?.map(
            (operatorGroup) => operatorGroup.group.name
          );
        }

        return [operatorGroup.group.name];
      },
    });
  }

  async getFoldersFromGroupNames({ groupNames = [] }) {
    const mappedGroupNames = groupNames.map((groupName) => `'${groupName}'`);

    return soapRequest({
      url: config.adobeSoapRouterUrl,
      token: this.accessToken,
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
                      <condition expr="[operator/@name] IN (${mappedGroupNames.join(
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

  async getDeliveriesFromFolderFullNameOrInternalName({
    fullName,
    internalName,
  }) {
    return soapRequest({
      url: config.adobeSoapRouterUrl,
      token: this.accessToken,
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
                ${
                  fullName
                    ? `<condition expr="[folder/@fullName]='${fullName}'"/>`
                    : ''
                }
                ${
                  internalName
                    ? `<condition expr="@internalName='${internalName}'"/>`
                    : ''
                }
              </where>
            </queryDef>
          </entity>
        </ExecuteQuery>
      `,
      formatResponseFn: (response) => {
        const body = response['SOAP-ENV:Envelope']['SOAP-ENV:Body'];

        const deliveryCollection =
          body.ExecuteQueryResponse.pdomOutput['delivery-collection'];

        const delivery = deliveryCollection?.delivery;

        if (delivery instanceof Array) {
          return deliveryCollection?.delivery?.map((delivery) => ({
            id: delivery.id,
            label: delivery.label,
            internalName: delivery.internalName,
          }));
        }

        return {
          id: delivery.id,
          label: delivery.label,
          internalName: delivery.internalName,
        };
      },
    });
  }

  async updateCampaignMail({ campaignMailData, html }) {
    // The logic to update and create is the same because the SOAP request that we do
    // for Adobe is an upsert
    this.createCampaignMail({ campaignMailData, html });
  }

  async createCampaignMail({ campaignMailData, html }) {
    const { name, adobe } = campaignMailData;

    await this.saveDeliveryTemplate({
      deliveryLabel: name,
      internalName: adobe.deliveryInternalName,
      accessToken: this.accessToken,
      folderFullName: adobe.folderFullName,
      contentHtml: html,
    });

    return name;
  }

  async saveDeliveryTemplate({
    deliveryLabel,
    internalName,
    accessToken,
    folderFullName,
    contentHtml,
  }) {
    return soapRequest({
      url: config.adobeSoapRouterUrl,
      token: accessToken,
      soapAction: 'xtk:persist#Write',
      xmlBodyRequest: `
        <m:Write xmlns:m="urn:xtk:persist|xtk:session">
          <sessiontoken></sessiontoken>
          <domDoc xsi:type='ns:Element'>
            <delivery xtkschema="nms:delivery" isModel="1" deliveryMode="4" internalName="${internalName}" label="${deliveryLabel}">
              <content>
                <html>
                  <source>
                    <![CDATA[
                      ${contentHtml}
                    ]]>
                  </source>
                </html>
              </content>
              <folder fullName="${folderFullName}" />
            </delivery>
          </domDoc>
        </m:Write>
      `,
    });
  }

  async uploadDeliveryImage({ image }) {
    const form = new FormData();

    form.append('file_noMd5', image);

    try {
      const response = await axios.post(config.adobeImgUrl, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${this.accessToken}`,
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
    return soapRequest({
      url: config.adobeSoapRouterUrl,
      token: this.accessToken,
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
    return soapRequest({
      url: config.adobeSoapRouterUrl,
      token: this.accessToken,
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
    const form = new FormData();

    form.append('type', 'access_token');
    form.append('client_id', 'exc_app');
    form.append('token', this.accessToken);

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

      const data = response.data;
      console.log('Response validate token', data);

      return data.valid;
    } catch (err) {
      console.error(
        'Error while validating token',
        err.response?.data || err.message
      );
    }
  }

  async getCampaignMail({ campaignId, folderName, internalName }) {
    try {
      if (!campaignId) {
        throw new InternalServerError(
          ERROR_CODES.MISSING_PROPERTIES_CAMPAIGN_MAIL_ID
        );
      }

      const apiEmailCampaignResult = await this.getDeliveriesFromFolderFullNameOrInternalName(
        { folderName, internalName }
      );

      const { label } = apiEmailCampaignResult;

      return {
        name: label,
        additionalApiData: {},
      };
    } catch (e) {
      logger.error(e);

      throw e;
    }
  }
}
module.exports = AdobeProvider;
