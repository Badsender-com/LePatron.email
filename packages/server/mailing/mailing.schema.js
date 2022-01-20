'use strict';

const _ = require('lodash');
const mongoose = require('mongoose');

const mongoosePaginate = require('mongoose-paginate-v2');
const config = require('../node.config.js');
const { normalizeString } = require('../utils/model');
const {
  UserModel,
  TemplateModel,
  GroupModel,
  WorkspaceModel,
  FolderModel,
} = require('../constant/model.names');
const logger = require('../utils/logger.js');

const { Schema, Types } = mongoose;
const { ObjectId } = Schema.Types;

/**
 * @apiDefine mailings
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {Date} createdAt creation date
 * @apiSuccess {Date} updatedAt last update date
 * @apiSuccess {Array[String]} tags tags list
 * @apiSuccess {String} userId the author's ID
 * @apiSuccess {String} userName the author's name
 * @apiSuccess {String} templateId The template it was based on
 * @apiSuccess {String} templateName
 * @apiSuccess {Object} group the group's mailing
 * @apiSuccess {String} group.id the group's ID
 * @apiSuccess {String} group.name the group's name
 */

const MailingSchema = Schema(
  {
    name: {
      type: String,
      required: true,
    },
    previewHtml: {
      type: String,
    },
    // _user can't be required: admin doesn't set a _user
    _user: { type: ObjectId, ref: UserModel, alias: 'userId' },
    // replicate user name for ordering purpose
    author: {
      type: String,
      set: normalizeString,
      alias: 'userName',
    },
    _workspace: {
      type: ObjectId,
      ref: WorkspaceModel,
      required: false,
      alias: 'workspace',
    },
    _parentFolder: {
      type: ObjectId,
      ref: FolderModel,
      required: false,
    },
    _wireframe: {
      type: ObjectId,
      required: true,
      ref: TemplateModel,
      // Ideally we should have run a script to migrate fields
      // • don't have time
      // • so just make an alias
      alias: 'templateId',
    },
    // replicate wireframe name for ordering purpose
    wireframe: {
      type: String,
      set: normalizeString,
      // Ideally we should have run a script to migrate fields
      // • don't have time
      // • so just make an alias
      alias: 'templateName',
    },
    // _company can't be required: admin doesn't have a _company
    _company: {
      type: ObjectId,
      ref: GroupModel,
      // Ideally we should have run a script to migrate fields
      // • don't have time
      // • so just make an alias
      alias: 'group',
    },
    tags: {
      type: [],
    },
    // http://mongoosejs.com/docs/schematypes.html#mixed
    data: {},
    espIds: {
      type: [],
    },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

MailingSchema.pre('find', function () {
  this._startTime = Date.now();
});

MailingSchema.post('find', function () {
  if (this._startTime != null) {
    logger.log('find Mailing Runtime: ', Date.now() - this._startTime);
  }
  this._startTime = null;
});
MailingSchema.plugin(mongoosePaginate);
// MailingSchema.plugin(mongooseHidden, {
//   hidden: {
//     __v: true,
//     _company: true,
//     _wireframe: true,
//     wireframe: true,
//     _user: true,
//     author: true,
//   },
// });

// http://stackoverflow.com/questions/18324843/easiest-way-to-copy-clone-a-mongoose-document-instance#answer-25845569
MailingSchema.methods.duplicate = function duplicate(_user) {
  const oldId = this._id.toString();
  const newId = Types.ObjectId();
  this._id = newId;
  this.name = `${this.name.trim()} copy`;
  this.isNew = true;
  this.espIds = [];
  this.createdAt = new Date();
  this.updatedAt = new Date();
  // set new user
  if (_user.id) {
    this._user = _user._id;
    this.author = _user.name;
  }
  // update all templates infos
  if (this.data) {
    let data = JSON.stringify(this.data);

    const replaceRegexp = new RegExp(oldId, 'gm');
    data = data.replace(replaceRegexp, String(newId));
    this.data = JSON.parse(data);
    this.markModified('data');
  }

  return this;
};
MailingSchema.index({ createdAt: 1 });
MailingSchema.index({ createdAt: -1 });
MailingSchema.index({ updatedAt: 1 });
MailingSchema.index({ updatedAt: -1 });
MailingSchema.index({ name: 1 });
MailingSchema.index({ name: -1 });
MailingSchema.index({ author: 1 });
MailingSchema.index({ author: -1 });
MailingSchema.index({ wireframe: 1 });
MailingSchema.index({ wireframe: -1 });
MailingSchema.index({ tags: 1 });
MailingSchema.index({ tags: -1 });

MailingSchema.statics.findForApi = async function findForApi(query = {}) {
  return this.find(query, { previewHtml: 0, data: 0 });
};

MailingSchema.statics.findForApiWithPagination = async function findForApiWithPagination(
  query = {}
) {
  const { paginationJSON, filtersJSON, ...restQuery } = query;
  const additionalQueryParams = {};

  if (paginationJSON && paginationJSON.page && paginationJSON.itemsPerPage) {
    additionalQueryParams.page = paginationJSON.page;
    additionalQueryParams.limit = parseInt(paginationJSON.itemsPerPage);
  }

  if (
    paginationJSON?.sortBy &&
    Array.isArray(paginationJSON.sortBy) &&
    paginationJSON?.sortDesc &&
    Array.isArray(paginationJSON.sortDesc)
  ) {
    let sortByKey;
    switch (paginationJSON.sortBy[0]) {
      case 'templateName':
        sortByKey = 'wireframe';
        break;
      case 'userName':
        sortByKey = 'author';
        break;
      default:
        sortByKey = paginationJSON.sortBy;
    }

    additionalQueryParams.sort = {
      [sortByKey]: paginationJSON.sortDesc[0] ? -1 : 1,
    };
  }
  if (filtersJSON) {
    if (filtersJSON.name) {
      restQuery.name = { $regex: filtersJSON.name, $options: 'i' };
    }

    if (
      Array.isArray(filtersJSON.templates) &&
      filtersJSON.templates?.length > 0
    ) {
      restQuery._wireframe = { $in: filtersJSON.templates };
    }

    if (Array.isArray(filtersJSON.tags) && filtersJSON.tags?.length > 0) {
      restQuery.tags = { $in: filtersJSON.tags };
    }

    if (filtersJSON.createdAtStart) {
      restQuery.createdAt = { $gte: new Date(filtersJSON.createdAtStart) };
    }

    if (filtersJSON.createdAtEnd) {
      restQuery.createdAt = {
        ...(restQuery.createdAt || {}),
        $lt: new Date(filtersJSON.createdAtEnd),
      };
    }

    if (filtersJSON.updatedAtStart) {
      restQuery.updatedAt = { $gte: new Date(filtersJSON.updatedAtStart) };
    }

    if (filtersJSON.updatedAtEnd) {
      restQuery.updatedAt = {
        ...(restQuery.updatedAt || {}),
        $lt: new Date(filtersJSON.updatedAtEnd),
      };
    }
  }

  const result = await this.paginate(restQuery, {
    projection: {
      id: '$_id',
      name: 1,
      group: '$_company',
      templateName: '$wireframe',
      templateId: '$_wireframe',
      userName: '$author',
      userId: '$_user',
      tags: 1,
      previewHtml: '$previewHtml',
      _workspace: 1,
      espIds: 1,
      updatedAt: 1,
      createdAt: 1,
    },
    lean: true,
    ...additionalQueryParams,
  });

  const { docs, ...restPaginationProperties } = result;

  const convertedResultMailingDocs = docs?.map(({ previewHtml, ...doc }) => ({
    hasHtmlPreview: !!previewHtml,
    ...doc,
  }));

  return { docs: convertedResultMailingDocs, ...restPaginationProperties };
};

// Use aggregate so we excluse previewHtml and define another boolean variable hasPreviewHtml based on the existence of previewHtml
MailingSchema.statics.findWithHasPreview = async function findWithHasPreview(
  query = {}
) {
  return this.aggregate([
    {
      $match: {
        ...query,
      },
    },
    {
      $addFields: {
        hasHtmlPreview: {
          $cond: [
            {
              $ifNull: ['$previewHtml', false],
            },
            '$previewHtml',
            1,
          ],
        },
      },
    },
    {
      $project: {
        id: '$_id',
        name: 1,
        group: '$_company',
        templateName: '$wireframe',
        templateId: '$_wireframe',
        userName: '$author',
        userId: '$_user',
        _workspace: 1,
        tags: 1,
        espIds: 1,
        hasHtmlPreview: 1,
        updatedAt: 1,
        createdAt: 1,
      },
    },
  ]);
};

// Extract used tags from creations
// http://stackoverflow.com/questions/14617379/mongoose-mongodb-count-elements-in-array
MailingSchema.statics.findTags = async function findTags(query = {}) {
  // const tags = await this.aggregate([
  //   {
  //     $match: {
  //       ...query,
  //       tags: { $exists: true },
  //     },
  //   },
  //   // { $unwind: `$tags` },
  //   // { $group: { _id: `$tags` } },
  //   // { $sort: { _id: 1 } },
  // ])

  const mailings = await this.find({
    ...query,
    tags: { $exists: true, $ne: [] },
  })
    .select({ tags: 1 })
    .lean();

  let tags = [];
  mailings.forEach(
    (mailing) => (tags = [...new Set([...tags, ...mailing.tags])])
  );

  return tags;
};

const translations = {
  en: _.assignIn(
    {},
    require('../../../public/lang/mosaico-en.json'),
    require('../../../public/lang/badsender-en')
  ),
  fr: _.assignIn(
    {},
    require('../../../public/lang/mosaico-fr.json'),
    require('../../../public/lang/badsender-fr')
  ),
};

/**
 * @apiDefine mailingMosaico
 * @apiSuccess {Object} metadata
 * @apiSuccess {String} metadata.id id
 * @apiSuccess {String} metadata.templateId id of the template
 * @apiSuccess {String} metadata.name name
 * @apiSuccess {String} metadata.template the URL where Mosaico will fetch the markup
 * @apiSuccess {Object} metadata.url an object of useful urls for Mosaico
 * @apiSuccess {String} metadata.url.update update URL
 * @apiSuccess {String} metadata.url.send send by mail URL
 * @apiSuccess {String} metadata.url.zip zip download URL
 * @apiSuccess {Object} metadata.assets templates assets list
 * @apiSuccess {Object} metadata.imagesUrl all API images endpoints for Mosaico
 * @apiSuccess {String} metadata.imagesUrl.images
 * @apiSuccess {String} metadata.imagesUrl.crop
 * @apiSuccess {String} metadata.imagesUrl.cover
 * @apiSuccess {String} metadata.imagesUrl.placeholder
 * @apiSuccess {String} metadata.editorIcon configuration for top-right icon
 * @apiSuccess {String} metadata.editorIcon.logoPath `src` of the logo
 * @apiSuccess {String} metadata.editorIcon.logoUrl link `href`
 * @apiSuccess {String} metadata.editorIcon.logoAlt alt text
 */

MailingSchema.statics.findOneForMosaico = async function findOneForMosaico(
  user,
  query = {},
  lang = 'fr'
) {
  const mailing = await this.findOne(query)
    .populate({
      path: '_company',
      select: { id: 1, name: 1 },
    })
    .populate({
      path: '_wireframe',
      select: { _id: 1, name: 1, _company: 1, assets: 1 },
    });
  if (!mailing) return mailing;

  // group is needed to check zip format
  // • a mailing without a group is from the “admin”
  // • so group configuration will be find on the template
  // • admin will have the same option as a company user
  const Groups = mongoose.models[GroupModel];
  const group = await Groups.findById(mailing._wireframe._company);
  if (!group) return group;

  // we try to keep a response as close as possible as the config used in the mosaico editor
  const mailingId = mailing._id;
  const groupId = group._id;
  const templateId = mailing._wireframe._id;

  let redirectUrl = null;

  if (user?.isAdmin) {
    redirectUrl = `/groups/${groupId}?redirectTab=mailings`;
  } else {
    redirectUrl = mailing?._parentFolder
      ? `/?fid=${mailing._parentFolder}`
      : `/?wid=${mailing._workspace}`;
  }

  return {
    metadata: {
      id: mailingId,
      groupId: groupId,
      templateId,
      name: mailing.name,
      hasHtmlPreview: !!mailing.previewHtml,
      // Mosaico's template loading URL
      template: `/api/templates/${templateId}/markup`,
      url: {
        update: `/api/mailings/${mailingId}/mosaico`,
        send: `/api/mailings/${mailingId}/mosaico/send-test-mail`,
        zip: `/api/mailings/${mailingId}/mosaico/download-zip`,
        profileList: `/api/profiles/${groupId}/profile-list-for-editor`,
        sendCampaignMail: `/api/profiles/${mailingId}/send-campaign-mail`,
      },
      downloadConfig: {
        cdnImages: group.downloadMailingWithCdnImages,
        cdnButtonLabel: group.cdnButtonLabel,
        ftpImages: group.downloadMailingWithFtpImages,
        ftpButtonLabel: group.ftpButtonLabel,
      },
      fileuploadConfig: {
        url: {
          mailing: `/api/images/gallery/${mailingId}`,
          template: `/api/images/gallery/${templateId}`,
        },
      },
      imagesUrl: {
        images: '/api/images/',
        crop: '/api/images/crop/',
        cover: '/api/images/cover/',
        placeholder: '/api/images/placeholder/',
      },
      assets: mailing._wireframe.assets,
      editorIcon: { ...config.brandOptions.editorIcon, logoUrl: redirectUrl },
    },
    titleToken: 'BADSENDER Responsive Email Designer',
    // TODO: should be in metadata
    // we will keep those URLS here for better control
    // • don't prepend basePath
    // • CORS errors can occur while using browserSync
    fileuploadConfig: {
      url: {
        mailing: `/api/images/gallery/${mailingId}`,
        template: `/api/images/gallery/${templateId}`,
      },
    },
    // TODO: this should be name downloadConfig and should be in metadata
    // this will be used to configure 2 DL options in UI
    download: {
      cdnImages: group.downloadMailingWithCdnImages,
      cdnButtonLabel: group.cdnButtonLabel,
      ftpImages: group.downloadMailingWithFtpImages,
      ftpButtonLabel: group.ftpButtonLabel,
    },
    // Mosaico absolutely need an object as `data`
    data: mailing.data || {},
    lang,
    strings: translations[lang],
  };
};

module.exports = MailingSchema;
