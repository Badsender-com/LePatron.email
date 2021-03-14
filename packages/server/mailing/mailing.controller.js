'use strict';

const createError = require('http-errors');
const asyncHandler = require('express-async-handler');
const { Types } = require('mongoose');

const simpleI18n = require('../helpers/server-simple-i18n.js');
const logger = require('../utils/logger.js');
const {
  Mailings,
  Templates,
  Galleries,
  Users,
} = require('../common/models.common.js');
const modelsUtils = require('../utils/model.js');
const sendTestMail = require('./send-test-mail.controller.js');
const downloadZip = require('./download-zip.controller.js');
const cleanTagName = require('../helpers/clean-tag-name.js');
const fileManager = require('../common/file-manage.service.js');

const mailingService = require('./mailing.service.js');

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
  read: asyncHandler(read),
  readMosaico: asyncHandler(readMosaico),
  update: asyncHandler(update),
  duplicate: asyncHandler(duplicate),
  updateMosaico: asyncHandler(updateMosaico),
  bulkUpdate: asyncHandler(bulkUpdate),
  bulkDestroy: asyncHandler(bulkDestroy),
  transferToUser: asyncHandler(transferToUser),
  // already wrapped in asyncHandler
  sendTestMail,
  downloadZip,
};
/**
 * @api {get} /mailings list of mailings
 * @apiPermission user
 * @apiName GetMailings
 * @apiGroup Mailings
 *
 * @apiUse mailings
 * @apiSuccess {mailings[]} items list of mailings
 * @apiSuccess {Object} meta
 * @apiSuccess {String[]} meta.tags all the tags used in those templates
 */

async function list(req, res) {
  // const mailingQueryStrictGroup = modelsUtils.addStrictGroupFilter(
  //   req.user,
  //   {}
  // );
  // const mailingQueryFolderParams = modelsUtils.addMailQueryParamFilter(
  //   req.query
  // );
  // const mailingQuery = {
  //   ...mailingQueryStrictGroup,
  //   ...mailingQueryFolderParams,
  // };

  let mailings = [];
  const tags = [];
  const { workspaceId } = req.query;
  if (workspaceId) {
    // TODO manage tag and other filter
    mailings = await mailingService.findMailings({ workspaceId });
  } else {
    // [mailings, tags] = await Promise.all([
    //   Mailings.findForApi(mailingQuery),
    //   Mailings.findTags(mailingQuery),
    // ]);
  }

  res.json({
    meta: { tags },
    items: mailings,
  });
}

/**
 * @api {post} /mailings mailing creation
 * @apiPermission user
 * @apiName CreateMailing
 * @apiGroup Mailings
 *
 * @apiParam (Body) {String} templateId the ID of the template used
 *
 * @apiUse mailings
 */

async function create(req, res) {
  const { user } = req;
  const { templateId, workspaceId } = req.body;
  console.log({ body: req.body });

  const query = modelsUtils.addGroupFilter(req.user, { _id: templateId });
  const template = await Templates.findOne(query).select({
    name: 1,
    _id: 1,
  });

  if (!template) throw new createError.NotFound();

  const initParameters = {
    // Always give a default name: needed for ordering & filtering
    name: simpleI18n('default-mailing-name', user.lang),
    templateId: template._id,
    templateName: template.name,
  };

  // admin doesn't have valid user id & company
  if (!user.isAdmin) {
    initParameters.userId = user.id;
    initParameters.userName = user.name;
    initParameters.group = user.group.id;
    initParameters.workspace = workspaceId;
  }
  const newMailing = await mailingService.createMailing(initParameters);

  // strangely toJSON doesn't render the data object
  // • cope with that by manually copy it in the response
  const response = newMailing.toJSON();
  response.data = newMailing.data;
  res.json(response);
}

/**
 * @api {get} /mailings/:mailingId mailing
 * @apiPermission user
 * @apiName GetMailing
 * @apiGroup Mailings
 *
 * @apiParam {string} mailingId
 *
 * @apiUse mailings
 */

async function read(req, res) {
  const { mailingId } = req.params;
  const query = modelsUtils.addGroupFilter(req.user, { _id: mailingId });
  const mailing = await Mailings.findOne(query);
  if (!mailing) throw new createError.NotFound();

  // strangely toJSON doesn't render the data object
  // • BUT there is no use send it outside of mosaico response which has it's own format
  // • if needed we can cope with that by manually copy it in the response (response.data = mailing.data)
  const response = mailing.toJSON();
  res.json(response);
}

/**
 * @api {get} /mailings/:mailingId/mosaico mailing for mosaico
 * @apiPermission user
 * @apiName GetMailingForMosaico
 * @apiGroup Mailings
 *
 * @apiParam {string} mailingId
 *
 * @apiUse mailingMosaico
 */

async function readMosaico(req, res) {
  const { mailingId } = req.params;
  const query = modelsUtils.addGroupFilter(req.user, { _id: mailingId });
  const mailingForMosaico = await Mailings.findOneForMosaico(
    query,
    req.user.lang
  );
  if (!mailingForMosaico) throw new createError.NotFound();

  res.json(mailingForMosaico);
}

/**
 * @api {put} /mailings/:mailingId mailing update
 * @apiPermission user
 * @apiName UpdateMailing
 * @apiGroup Mailings
 *
 * @apiParam {string} mailingId
 *
 * @apiParam (Body) {Object} mailing
 * @apiParam (Body) {String} mailing.name
 *
 * @apiUse mailings
 */

async function update(req, res) {
  const { mailingId } = req.params;
  const query = modelsUtils.addGroupFilter(req.user, { _id: mailingId });
  const mailing = await Mailings.findOne(query);
  if (!mailing) throw new createError.NotFound();

  mailing.name =
    modelsUtils.normalizeString(req.body.name) ||
    simpleI18n('default-mailing-name', req.user.lang);
  await mailing.save();

  const responseMailing = await Mailings.findOne(query);
  // strangely toJSON doesn't render the data object
  // • BUT there is no use send it outside of mosaico response which has it's own format
  // • if needed we can cope with that by manually copy it in the response (response.data = mailing.data)
  const response = responseMailing.toJSON();
  res.json(response);
}

/**
 * @api {post} /mailings/:mailingId/duplicate mailing duplication
 * @apiPermission user
 * @apiName DuplicateMailing
 * @apiGroup Mailings
 *
 * @apiParam {string} mailingId
 *
 * @apiUse mailings
 */

// TODO: while duplicating we should copy only the used images by the creation
async function duplicate(req, res) {
  const { mailingId } = req.params;
  const query = modelsUtils.addGroupFilter(req.user, { _id: mailingId });
  const [mailing, gallery] = await Promise.all([
    Mailings.findOne(query),
    Galleries.findOne({ creationOrWireframeId: mailingId }),
  ]);
  if (!mailing) throw new createError.NotFound();

  const duplicatedMailing = mailing.duplicate(req.user);
  // Be sure that all images are duplicated before saving the duplicated creation
  await fileManager.copyImages(mailingId, duplicatedMailing._id);
  await duplicatedMailing.save();

  try {
    // if gallery can't be created it's not a problem
    // • it will be created when opening the duplicated creation
    // • we only loose hidden images
    // → MEANINGFUL OMISSION OF AWAIT
    if (gallery) gallery.duplicate(duplicatedMailing._id).save();
  } catch (error) {
    logger.warn(
      `MAILING DUPLICATE – can't duplicate gallery for ${duplicatedMailing._id}`
    );
  }
  const responseMailing = await Mailings.findById(duplicatedMailing._id);
  // strangely toJSON doesn't render the data object
  // • BUT there is no use send it outside of mosaico response which has it's own format
  // • if needed we can cope with that by manually copy it in the response (response.data = mailing.data)
  const response = responseMailing.toJSON();
  res.json(response);
}

/**
 * @api {put} /mailings/:mailingId/mosaico mailing update from mosaico
 * @apiPermission user
 * @apiName UpdateMailingForMosaico
 * @apiGroup Mailings
 *
 * @apiParam {string} mailingId
 *
 * @apiUse mailingMosaico
 */

async function updateMosaico(req, res) {
  const { user } = req;
  const { mailingId } = req.params;
  const query = modelsUtils.addGroupFilter(req.user, { _id: mailingId });
  const mailing = await Mailings.findOne(query);
  if (!mailing) throw new createError.NotFound();

  mailing.data = req.body.data || mailing.data;
  mailing.name =
    modelsUtils.normalizeString(req.body.name) ||
    simpleI18n('default-mailing-name', user.lang);
  // http://mongoosejs.com/docs/schematypes.html#mixed
  mailing.markModified('data');
  await mailing.save();
  const mailingForMosaico = await Mailings.findOneForMosaico(
    query,
    req.user.lang
  );
  res.json(mailingForMosaico);
}

/**
 * @api {put} /mailings mailings bulk update
 * @apiPermission user
 * @apiName MailingBulkUpdate
 * @apiGroup Mailings
 * @apiDescription This will only allow to update the tags list of the mailings
 *
 * @apiParam (Body) {String[]} items the list of mailings ID to update
 * @apiParam (Body) {Object} tags
 * @apiParam (Body) {String[]} tags.added the list of tags to add
 * @apiParam (Body) {String[]} tags.removed the list of tags to remove
 *
 * @apiUse mailings
 * @apiSuccess {mailings[]} items list of mailings
 * @apiSuccess {Object} meta
 * @apiSuccess {String[]} meta.tags all the tags used in those templates
 */

async function bulkUpdate(req, res) {
  const { items, tags: tagsChanges = {} } = req.body;
  const hadId = Array.isArray(items) && items.length;
  const hasTagsChanges =
    Array.isArray(tagsChanges.added) && Array.isArray(tagsChanges.removed);
  if (!hadId || !hasTagsChanges) {
    throw new createError.UnprocessableEntity();
  }

  const mailingQuery = modelsUtils.addStrictGroupFilter(req.user, {
    _id: { $in: items.map(Types.ObjectId) },
  });
  // ensure the mailings are from the same group
  const userMailings = await Mailings.find(mailingQuery).select({
    _id: 1,
    tags: 1,
  });
  const updateQueries = userMailings.map((mailing) => {
    const { tags: orignalTags } = mailing;
    const uniqueUpdatedTags = [
      ...new Set([...tagsChanges.added, ...orignalTags]),
    ];
    const updatedTags = uniqueUpdatedTags.filter(
      (tag) => !tagsChanges.removed.includes(tag)
    );
    mailing.tags = updatedTags.map(cleanTagName).sort();
    return mailing.save();
  });
  await Promise.all(updateQueries);
  const [mailings, tags] = await Promise.all([
    Mailings.findForApi(mailingQuery),
    Mailings.findTags(modelsUtils.addStrictGroupFilter(req.user, {})),
  ]);
  res.json({
    meta: { tags },
    items: mailings,
  });
}

/**
 * @api {del} /mailings mailings bulk delete
 * @apiPermission user
 * @apiName MailingBulkDelete
 * @apiGroup Mailings
 *
 * @apiParam (Body) {String[]} items the list of mailings ID to remove
 *
 * @apiSuccess {items[]} items list of delete id
 * @apiSuccess {Object} meta
 * @apiSuccess {String[]} meta.tags all the tags used in those templates
 */

async function bulkDestroy(req, res) {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length)
    throw new createError.UnprocessableEntity();

  const mailingQuery = modelsUtils.addStrictGroupFilter(req.user, {
    _id: { $in: items.map(Types.ObjectId) },
  });
  // ensure the mailings are from the same group
  const userMailings = await Mailings.find(mailingQuery)
    .select({ _id: 1 })
    .lean();
  const safeMailingsIdList = userMailings.map((mailing) =>
    Types.ObjectId(mailing._id)
  );
  // Mongo responseFormat
  // { n: 1, ok: 1, deletedCount: 1 }
  // => nothing useful for a response :/
  const [mailingDeletionResult, galleryDeletionResult] = await Promise.all([
    Mailings.deleteMany({ _id: { $in: safeMailingsIdList } }),
    Galleries.deleteMany({
      creationOrWireframeId: { $in: safeMailingsIdList },
    }),
  ]);
  console.log({ mailingDeletionResult, galleryDeletionResult });
  const tags = await Mailings.findTags(
    modelsUtils.addStrictGroupFilter(req.user, {})
  );

  res.json({
    meta: { tags },
    items: safeMailingsIdList.map(String),
  });
}

/**
 * @api {post} /mailings/:mailingId/transfer-to-user mailing transfer
 * @apiPermission admin
 * @apiName TransferMailingToUser
 * @apiGroup Mailings
 * @apiDescription transfer a mailing created by the admin to a user
 *
 * @apiParam {string} mailingId
 *
 * @apiParam (Body) {String} userId the user ID to assign this mailing to
 *
 * @apiUse mailings
 */

async function transferToUser(req, res) {
  const { userId } = req.body;
  const { mailingId } = req.params;

  const [user, mailing] = await Promise.all([
    Users.findById(userId, { name: 1, _company: 1 }),
    Mailings.findById(mailingId, { name: 1 }).populate('_wireframe', {
      _company: 1,
    }),
  ]);

  if (!user || !mailing) throw new createError.NotFound();
  const isMailingFromSameGroupThanUser =
    String(user._company) === String(mailing._wireframe._company);
  if (!isMailingFromSameGroupThanUser) throw new createError.BadRequest();

  mailing.userId = user._id;
  mailing.userName = user.name;
  mailing.group = user._company;
  await mailing.save();

  const updatedMailing = await Mailings.findById(mailingId);
  // strangely toJSON doesn't render the data object
  // • BUT there is no use send it outside of mosaico response which has it's own format
  // • if needed we can cope with that by manually copy it in the response (response.data = updatedMailing.data)
  const response = updatedMailing.toJSON();
  res.json(response);
}
