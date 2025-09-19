'use_strict';
const logger = require('../../utils/logger.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const config = require('../../node.config.js');
const axios = require('../../config/axios');
const { InternalServerError } = require('http-errors');
const qs = require('qs');
const soapRequest = require('../../../server/utils/soap-request');
const { getMd5FromBlob } = require('../../../server/utils/crypto.js');
const fetch = require('node-fetch');
const FormData = require('form-data');
const {
  asyncReplace,
} = require('../../../server/utils/download-zip-markdown.js');
const { createLog } = require('../../../server/log/log.service.js');
const { Profiles } = require('../../../server/common/models.common.js');
const { Types } = require('mongoose');
const ADOBE_TYPES = require('../../constant/adobe-target-types.js');
const {
  handleTrackingData,
  getMailByMailingIdAndUser,
} = require('../../mailing/mailing.service.js');

class AdobeProvider {
  constructor({
    apiKey,
    secretKey,
    targetType,
    accessToken,
    profileId,
    userId,
    ...data
  }) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.targetType = targetType;
    this.profileId = profileId;
    this.accessToken = accessToken;
    this.userId = userId;
    this.data = data;

    if (!targetType) {
      this.targetType = ADOBE_TYPES.NMS_DELIVERY_MODEL;
    } else if (!Object.values(ADOBE_TYPES).includes(targetType)) {
      throw new Error('Invalid targetType provided to AdobeProvider');
    } else {
      this.targetType = targetType;
    }
  }

  static async build(initialData) {
    const provider = new AdobeProvider(initialData);

    if (!initialData.accessToken) {
      provider.accessToken = await provider.refreshToken();
    }

    return provider;
  }

  async connectApiCall(data) {
    return axios.post(`${config.adobeImsUrl}/ims/token/v3`, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  async connectApi() {
    const data = qs.stringify({
      client_id: this.apiKey,
      client_secret: this.secretKey,
      grant_type: 'client_credentials',
      scope:
        'AdobeID,openid,read_organizations,additional_info.projectedProductContext,additional_info.roles,adobeio_api,read_client_secret,manage_client_secrets,campaign_sdk,campaign_config_server_general,deliverability_service_general',
    });
    try {
      const emailCampaignConnectionResult = await this.connectApiCall(data);
      return emailCampaignConnectionResult;
    } catch (e) {
      if (e?.response?.status === 400) {
        if (
          e?.response?.data?.error_description === 'invalid client_id parameter'
        ) {
          await this.handleAdobeError(e, ERROR_CODES.ADOBE_INVALID_CLIENT);
        }
        if (
          e?.response?.data?.error_description ===
          'invalid client_secret parameter'
        ) {
          await this.handleAdobeError(e, ERROR_CODES.ADOBE_INVALID_SECRET);
        }
      }
      await this.handleAdobeError(e, ERROR_CODES.ADOBE_INTERNAL_ERROR);
    }
  }

  async refreshToken() {
    try {
      const espConnectionResult = await this.connectApi();
      if (!espConnectionResult) {
        throw new InternalServerError(ERROR_CODES.UNEXPECTED_SERVER_ERROR);
      }
      const accessToken = espConnectionResult.data.access_token;

      await Profiles.updateOne(
        { _id: Types.ObjectId(this.profileId) },
        { accessToken }
      );

      return accessToken;
    } catch (e) {
      if (e?.response?.status === 400) {
        if (
          e?.response?.data?.error_description === 'invalid client_id parameter'
        ) {
          await this.handleAdobeError(e, ERROR_CODES.ADOBE_INVALID_CLIENT);
        }
        if (
          e?.response?.data?.error_description ===
          'invalid client_secret parameter'
        ) {
          await this.handleAdobeError(e, ERROR_CODES.ADOBE_INVALID_SECRET);
        }
      }
      await this.handleAdobeError(e, ERROR_CODES.ADOBE_INTERNAL_ERROR);
    }
  }

  async getUserGroups({ user }) {
    const username = config.isDev ? config.adobeDefaultUser : user.email;

    return this.makeSoapRequest({
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

  /**
   * Retrieves folder information with writting rights based on provided group names and folder type from Adobe Campaign via a SOAP request.
   *
   * Differences between the two types:
   * - If `type` is `ADOBE_TYPES.NMS_DELIVERY`, it returns folders with the delivery model.
   * - If `type` is `ADOBE_TYPES.NMS_DELIVERY_MODEL`,  it returns folders with the deliveryModel (template) model.
   *
   * @async
   * @param {string[]} [groupNames=[]] - An array of operator group names to filter folders by.
   * @param {string} [type=ADOBE_TYPES.NMS_DELIVERY_MODEL] - The folder model type to filter by (e.g., delivery model).
   *
   **/
  async getFoldersFromGroupNames({
    groupNames = [],
    type = ADOBE_TYPES.NMS_DELIVERY_MODEL,
  }) {
    const mappedGroupNames = groupNames.map((groupName) => `'${groupName}'`);

    return this.makeSoapRequest({
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
                      <condition expr="[folder/@model]='${type}'" />
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

  /**
   * Retrieves deliveries from Adobe Campaign based on either the folder's full name or the delivery's internal name.
   *
   * Differences between the two types:
   * - If `type` is `ADOBE_TYPES.NMS_DELIVERY`, the query is further filtered to only include deliveries with `@state=0` (draft) and `@messageType=0` (email).
   * - If `type` is `ADOBE_TYPES.NMS_DELIVERY_MODEL`, the query is not filtered as we don't need this kind of information.
   *
   * @async
   * @param {string} fullName - The full name of the folder to filter deliveries by. If provided, only deliveries in this folder are returned.
   * @param {string} internalName - The internal name of the delivery to filter by. If provided, only the delivery with this internal name is returned.
   * @param {string} type - The type of delivery to filter by. If set to `ADOBE_TYPES.NMS_DELIVERY`, only draft email deliveries are returned, otherwise all deliveries templates are returned.
   */
  async getDeliveriesFromFolderFullNameOrInternalName({
    fullName,
    internalName,
    type,
  }) {
    return this.makeSoapRequest({
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
                <node expr="@lastModified"/>
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
                ${
                  type === ADOBE_TYPES.NMS_DELIVERY
                    ? '<condition expr="@state=0"/>'
                    : ''
                }
                ${
                  type === ADOBE_TYPES.NMS_DELIVERY
                    ? '<condition expr="@messageType=0"/>'
                    : ''
                }

              </where>
              <orderBy>
                <node expr="@lastModified" sortDesc="true"/>
              </orderBy>
            </queryDef>
          </entity>
        </ExecuteQuery>
      `,
      formatResponseFn: (response) => {
        const body = response['SOAP-ENV:Envelope']['SOAP-ENV:Body'];

        const deliveryCollection =
          body.ExecuteQueryResponse.pdomOutput['delivery-collection'];

        const delivery = deliveryCollection?.delivery;

        if (!delivery) {
          return [];
        }

        if (delivery instanceof Array) {
          return deliveryCollection?.delivery?.map((delivery) => ({
            id: delivery.id,
            label: delivery.label,
            internalName: delivery.internalName,
          }));
        }

        return [
          {
            id: delivery.id,
            label: delivery.label,
            internalName: delivery.internalName,
          },
        ];
      },
    });
  }

  async updateCampaignMail({ campaignMailData, user, html, mailingId }) {
    // The logic to update and create is the same because the SOAP request that we do
    // for Adobe is an upsert
    await this.createCampaignMail({ campaignMailData, user, html, mailingId });
  }

  async createCampaignMail({ campaignMailData, user, html, mailingId }) {
    const { name, adobe } = campaignMailData;

    const mailing = await getMailByMailingIdAndUser({ mailingId, user });

    const htmlWithAdobeUrls = await this.sendAndProcessImageIntoAdobe({
      html,
      tracking: mailing?._doc?.data?.tracking,
    });

    await this.saveDeliveryTemplate({
      internalName: adobe.deliveryInternalName,
      folderFullName: adobe.folderFullName,
      contentHtml: htmlWithAdobeUrls,
    });

    return name;
  }

  async sendAndProcessImageIntoAdobe({ html, tracking }) {
    const { html: htmlWithTracking } = handleTrackingData({
      html,
      tracking,
    });
    const urlsRegexUrl = /https?:\S+\.(jpg|jpeg|png|gif|webp)/g;

    const replacedHtml = await asyncReplace(
      htmlWithTracking,
      urlsRegexUrl,
      async (match, tag) => {
        const splittedMatch = match.split('/');
        const imageName = splittedMatch[splittedMatch.length - 1];
        const response = await fetch(match);
        const blob = await response.blob();

        const md5 = await getMd5FromBlob(blob);

        try {
          await this.uploadDeliveryImage({
            image: blob.stream(),
            optionImg: {
              filename: imageName,
              contentType: blob.type,
              knownLength: await blob.size,
            },
          });
        } catch (uploadError) {
          await this.handleAdobeError(
            uploadError,
            ERROR_CODES.ADOBE_UPLOAD_ERROR
          );
        }

        try {
          await this.saveDeliveryImage({ imageMd5: md5, imageName });
        } catch (saveError) {
          await this.handleAdobeError(saveError, ERROR_CODES.ADOBE_SAVE_ERROR);
        }

        try {
          await this.publishDeliveryImage({ imageMd5: md5, imageName });
        } catch (publishError) {
          await this.handleAdobeError(
            publishError,
            ERROR_CODES.ADOBE_PUBLISH_ERROR
          );
        }

        try {
          const url = await this.getImageUrl({ imageMd5: md5 });
          return `${url}${tag}`;
        } catch (getImageError) {
          await this.handleAdobeError(
            getImageError,
            ERROR_CODES.ADOBE_GET_IMAGE_URL_ERROR
          );
        }
      }
    );

    return replacedHtml;
  }

  // TODO verify if the isModel is a problem for delivery save
  async saveDeliveryTemplate({ internalName, folderFullName, contentHtml }) {
    return this.makeSoapRequest({
      soapAction: 'xtk:persist#Write',
      xmlBodyRequest: `
      <m:Write xmlns:m="urn:xtk:persist|xtk:session">
        <sessiontoken></sessiontoken>
        <domDoc xsi:type='ns:Element'>
          <delivery xtkschema="nms:delivery" isModel="1" deliveryMode="4" internalName="${internalName}" _operation="update">
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

  async handleAdobeError(error, errorCode) {
    const { config, response } = error;
    logger.error({
      errorResponseData: error?.response?.data,
    });

    const log = await createLog({
      query: JSON.stringify(config),
      responseStatus: response?.status,
      response: JSON.stringify(response?.data),
    });

    error.logId = log?.id;
    error.response.data.message = errorCode;
    throw error;
  }

  async uploadDeliveryImage({ image, optionImg }) {
    const form = new FormData();

    form.append('file_noMd5', image, optionImg);

    try {
      await axios.post(config.adobeUploadFileUrl, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
    } catch (err) {
      console.error('Error while uploading delivery image:', err);
    }
  }

  async saveDeliveryImage({ imageMd5, imageName }) {
    return this.makeSoapRequest({
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
    return this.makeSoapRequest({
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

  async getImageUrl({ imageMd5 }) {
    return this.makeSoapRequest({
      soapAction: 'xtk:fileRes#GetURL',
      xmlBodyRequest: `
        <m:GetURL xmlns:m="urn:xtk:fileRes">
          <sessiontoken xsi:type="xsd:string" />
          <document xsi:type="">
            <fileRes md5="${imageMd5}" useMd5AsFilename="1" storageType="5" />
          </document>
        </m:GetURL>
      `,
      formatResponseFn: (response) =>
        response['SOAP-ENV:Envelope']['SOAP-ENV:Body'].GetURLResponse.pstrUrl
          .$t,
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

      return response.data.valid;
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

  async makeSoapRequest({ soapAction, xmlBodyRequest, formatResponseFn }) {
    return soapRequest({
      userId: this.userId,
      url: config.adobeSoapRouterUrl,
      token: this.accessToken,
      soapAction,
      xmlBodyRequest,
      formatResponseFn,
      refreshTokenFn: async () => {
        this.accessToken = await this.refreshToken();
        return this.accessToken;
      },
    });
  }
}
module.exports = AdobeProvider;
