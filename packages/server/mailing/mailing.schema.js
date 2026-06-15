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
  CommentModel,
} = require('../constant/model.names');
const logger = require('../utils/logger.js');
const AIFeatureTypes = require('../constant/ai-feature-type');

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
    tags: [
      {
        type: String,
      },
    ],
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
MailingSchema.index({ _company: 1, tags: 1 });
MailingSchema.index({ _company: 1, _parentFolder: 1, updatedAt: -1 });
MailingSchema.index({ _company: 1, _workspace: 1, updatedAt: -1 });
// Admin group-wide listing (GET /groups/:groupId/mailings → group.controller
// readMailings) sorts ALL of a company's mailings by one column. Without a
// composite { _company, <sortField> } index, Mongo scans a global single-field
// index and filters _company doc-by-doc, which times out on large companies.
// One index per sortable column of the admin table (admin-table.vue); a single
// direction suffices since Mongo can read an index in reverse.
MailingSchema.index({ _company: 1, updatedAt: -1 });
MailingSchema.index({ _company: 1, createdAt: -1 });
MailingSchema.index({ _company: 1, name: 1 });
MailingSchema.index({ _company: 1, wireframe: 1 });
MailingSchema.index({ _company: 1, author: 1 });
MailingSchema.index({ _user: 1 });
MailingSchema.index({ _parentFolder: 1 });

MailingSchema.statics.findForApi = async function findForApi(query = {}) {
  return this.find(query, { previewHtml: 0, data: 0 });
};

MailingSchema.statics.findForApiWithPagination = async function findForApiWithPagination(
  query = {}
) {
  const { paginationJSON, filtersJSON, ...restQuery } = query;
  const additionalQueryParams = {};

  if (paginationJSON && paginationJSON.page && paginationJSON.itemsPerPage) {
    if (paginationJSON.itemsPerPage !== -1) {
      additionalQueryParams.page = paginationJSON.page;
      additionalQueryParams.limit = parseInt(paginationJSON.itemsPerPage);
    } else {
      additionalQueryParams.pagination = false;
    }
  }

  if (
    Array.isArray(paginationJSON?.sortBy) &&
    Array.isArray(paginationJSON?.sortDesc)
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
        [sortByKey] = paginationJSON.sortBy;
    }

    additionalQueryParams.sort = {
      [sortByKey]: paginationJSON.sortDesc[0] ? -1 : 1,
    };
  }
  if (filtersJSON) {
    if (filtersJSON.name) {
      // Escape regex metacharacters to avoid ReDoS and accidental pattern injection.
      const escapedName = filtersJSON.name.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );
      restQuery.name = { $regex: escapedName, $options: 'i' };
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
      wireframe: 1,
      templateId: '$_wireframe',
      author: 1,
      userId: '$_user',
      tags: 1,
      _workspace: 1,
      espIds: 1,
      updatedAt: 1,
      createdAt: 1,
    },
    lean: true,
    ...additionalQueryParams,
  });

  const { docs, ...restPaginationProperties } = result;

  const ids = docs.map((doc) => doc._id);

  // Derive the preview-badge flag without transferring the (potentially large)
  // rendered-email HTML for every row. A find() projection can't compute a
  // boolean from `previewHtml` because mongoose-paginate-v2 uses .find(), whose
  // projection rejects aggregation expressions ($ne/$cond/$ifNull) — so we fetch
  // only the _ids that have it. This _id-only query is cheap.
  //
  // "Has a preview" means non-empty, not merely present: the download/FTP flow
  // sends `previewHtml` verbatim as the email body (mailing.service.js), so an
  // empty string is nothing to download. Matches the `!!previewHtml` semantics
  // used by the other listing path (findWithHasPreview).
  const mailingsWithHtmlPreview = await this.find(
    { _id: { $in: ids }, previewHtml: { $exists: true, $nin: [null, ''] } },
    { _id: 1 }
  ).lean();
  const mailingsWithHtmlPreviewSet = new Set(
    mailingsWithHtmlPreview.map((mailing) => mailing._id.toString())
  );

  // Get unresolved comment counts for each mailing
  const Comment = mongoose.models[CommentModel];
  let commentCountsMap = {};
  if (Comment) {
    const commentCounts = await Comment.aggregate([
      {
        $match: {
          _mailing: { $in: ids },
          _parentComment: null,
          resolved: false,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$_mailing',
          count: { $sum: 1 },
        },
      },
    ]);
    commentCountsMap = commentCounts.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});
  }

  // Strip previewHtml defensively: the projection above already omits it, but
  // destructuring it out here keeps the "never serve the blob in the listing"
  // invariant even if a future change reprojects it. `hasHtmlPreview` carries
  // the only bit the client needs.
  const finalDocs = docs.map(({ previewHtml: _previewHtml, ...doc }) => ({
    ...doc,
    hasHtmlPreview: mailingsWithHtmlPreviewSet.has(doc._id.toString()),
    unresolvedCommentsCount: commentCountsMap[doc._id.toString()] || 0,
  }));

  const convertedResultMailingDocs = finalDocs.map(
    ({ wireframe, author, ...doc }) => ({
      templateName: wireframe,
      userName: author,
      ...doc,
    })
  );

  return { docs: convertedResultMailingDocs, ...restPaginationProperties };
};

// addTagsToEmail method to add tags to an email and increment the usage count
MailingSchema.statics.addTagsToEmail = async function addTagsToEmail(
  emailId,
  tagLabels
) {
  const email = await this.findById(emailId);
  if (email) {
    email.tags.push(...tagLabels);
    await email.save();
    await mongoose.models.Tag.updateMany(
      { label: { $in: tagLabels }, companyId: email._company },
      { $inc: { usageCount: 1 } }
    );
  }
};

MailingSchema.statics.findTags = async function findTags(query = {}) {
  const { _company: companyId } = query;

  // Find tags by company ID and sort them alphabetically by label
  const tags = await mongoose.models.Tag.find({ companyId })
    .sort({ label: 1 }) // Sort tags by label in ascending order
    .lean();

  return tags.map(({ label }) => label);
};

// removeTagsFromEmail method to remove tags from an email and decrement the usage count
MailingSchema.statics.removeTagsFromEmail = async function removeTagsFromEmail(
  emailId,
  tagLabels
) {
  // Find the email by ID
  const email = await this.findById(emailId);
  if (email) {
    // Remove the specified tags from the email
    email.tags = email.tags.filter((label) => !tagLabels.includes(label));
    await email.save();

    // Decrement the usage count for the specified tags
    await mongoose.models.Tag.updateMany(
      { label: { $in: tagLabels }, companyId: email._company },
      { $inc: { usageCount: -1 } }
    );

    // Retrieve the updated tags to check their usage count
    const updatedTags = await mongoose.models.Tag.find({
      label: { $in: tagLabels },
      companyId: email._company,
    });

    // Delete tags with a usage count of zero
    const tagsToRemove = updatedTags
      .filter((tag) => tag.usageCount <= 0)
      .map((tag) => tag._id);
    if (tagsToRemove.length > 0) {
      await mongoose.models.Tag.deleteMany({ _id: { $in: tagsToRemove } });
    }
  }
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
  // • a mailing without a group is from the "admin"
  // • so group configuration will be find on the template
  // • admin will have the same option as a company user
  const Groups = mongoose.models[GroupModel];
  const group = await Groups.findById(mailing._wireframe._company);
  if (!group) return group;

  // we try to keep a response as close as possible as the config used in the mosaico editor
  const mailingId = mailing._id;
  const groupId = group._id;
  const templateId = mailing._wireframe._id;

  // Check if translation feature is available for this group
  // Lazy require to avoid circular dependency
  const aiFeatureService = require('../ai-feature/ai-feature.service');
  const translationFeatureConfig = await aiFeatureService.getActiveFeatureWithIntegration(
    {
      groupId,
      featureType: AIFeatureTypes.TRANSLATION,
    }
  );
  const hasTranslationFeature = !!(
    translationFeatureConfig &&
    translationFeatureConfig.feature.isActive &&
    translationFeatureConfig.integration &&
    translationFeatureConfig.integration.isActive
  );

  let redirectUrl = null;

  if (user?.isAdmin) {
    redirectUrl = `/groups/${groupId}?redirectTab=mailings`;
  } else {
    // Target the Email Builder route directly (`/mailings`), not the app root
    // (`/`). The root only redirects to the first enabled module and was
    // dropping the query string, landing the user on an empty page with no
    // sidebar. `/mailings?fid=/wid=` mounts the workspace tree on the right
    // folder/workspace.
    redirectUrl = mailing?._parentFolder
      ? `/mailings?fid=${mailing._parentFolder}`
      : `/mailings?wid=${mailing._workspace}`;
  }

  return {
    metadata: {
      id: mailingId,
      groupId: groupId,
      templateId,
      name: mailing.name,
      hasHtmlPreview: !!mailing.previewHtml,
      hasTranslationFeature,
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
