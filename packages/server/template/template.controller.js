'use strict'

const _ = require('lodash')
const createError = require('http-errors')
const asyncHandler = require('express-async-handler')

const {
  Templates,
  Mailings,
  Groups,
  Galleries,
} = require('../common/models.common.js')
const logger = require('../utils/logger.js')
const modelsUtils = require('../utils/model.js')
const fileManager = require('../common/file-manage.service.js')
const generatePreview = require('./generate-preview.controller.js')
const _getTemplateImagePrefix = require('../utils/get-template-image-prefix.js')

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
  read: asyncHandler(read),
  readMarkup: asyncHandler(readMarkup),
  update: asyncHandler(update),
  destroy: asyncHandler(destroy),
  destroyImages: asyncHandler(destroyImages),
  // expose generate preview controllers
  ...generatePreview,
}

/**
 * @api {get} /templates list of templates
 * @apiPermission user
 * @apiName GetTemplates
 * @apiDescription list of templates
 * @apiGroup Templates
 *
 * @apiUse templates
 * @apiSuccess {templates[]} items list of templates
 */

async function list(req, res) {
  const templateQuery = modelsUtils.addGroupFilter(req.user, {})
  const templates = await Templates.findForApi(templateQuery)
  res.json({ items: templates })
}

/**
 * @api {post} /templates template creation
 * @apiPermission admin
 * @apiName CreateTemplate
 * @apiGroup Templates
 *
 * @apiParam (Body) {String} groupId the ID of the template's group
 * @apiParam (Body) {String} name
 * @apiParam (Body) {String} [description]
 *
 * @apiUse template
 */

async function create(req, res) {
  const { groupId } = req.body
  const group = await Groups.findById(groupId)
    .select(`_id`)
    .lean()
  if (!group) throw new createError.BadRequest(`group not found`)

  const templateParams = _.pick(req.body, [`name`, `description`])
  const newTemplate = await Templates.create({
    _company: groupId,
    ...templateParams,
  })
  const template = await Templates.findById(newTemplate._id).populate({
    path: `_company`,
    select: `id name`,
  })
  res.json(template)
}

/**
 * @api {get} /templates/:templateId template
 * @apiPermission user
 * @apiName GetTemplate
 * @apiGroup Templates
 *
 * @apiParam {string} templateId
 *
 * @apiUse template
 */

async function read(req, res) {
  const { templateId } = req.params
  const template = await Templates.findById(templateId).populate({
    path: `_company`,
    select: `id name`,
  })
  if (!template) throw new createError.NotFound()
  res.json(template)
}

/**
 * @api {get} /templates/:templateId/markup template markup
 * @apiPermission user
 * @apiName GetTemplateMarkup
 * @apiGroup Templates
 *
 * @apiParam {String} templateId
 * @apiParam (Query params) {Boolean} [download=false] if you want to download it or not
 *
 * @apiSuccess {String} body the template markup
 */

async function readMarkup(req, res) {
  const { templateId } = req.params
  const { download } = req.query
  const templateQuery = modelsUtils.addGroupFilter(req.user, {
    _id: templateId,
  })
  const template = await Templates.findOne(templateQuery)
  if (!template.markup) throw new createError.NotFound()
  if (!download) return res.send(template.markup)
  // let download content
  res.setHeader(
    `Content-disposition`,
    `attachment; filename=${template.name}.html`,
  )
  res.setHeader(`Content-type`, `text/html`)
  res.write(template.markup)
  res.end()
}

/**
 * @api {put} /templates/:templateId template update
 * @apiPermission admin
 * @apiName UpdateTemplate
 * @apiGroup Templates
 * @apiHeader {String} content-type have to be `multipart/form-data`
 *
 * @apiParam {string} templateId
 * @apiParam (Body) {String} name
 * @apiParam (Body) {String} [description]
 * @apiParam (Body) {File} [markup] HTML Form-based File Upload
 * @apiParam (Body) {File[]} [images] Images Form-based File Upload
 *
 * @apiUse template
 */

async function update(req, res, next) {
  const { templateId } = req.params
  const body = await fileManager.parseMultipart(req, {
    // add a `wireframe` prefix to differ from user uploaded template assets
    prefix: _getTemplateImagePrefix(templateId),
    formatter: `templates`,
  })
  const template = await Templates.findById(templateId)
  if (!template) throw new createErrors.NotFound()
  // custom update function
  const updatedTemplate = _.assignIn(
    template,
    _.omit(body, [`images`, `assets`]),
  )
  updatedTemplate.assets = _.assign(
    {},
    updatedTemplate.assets || {},
    body.assets,
  )
  updatedTemplate.markModified(`assets`)

  // copy template name in mailing
  // • we don't need for this DB request to finish to give the user the response
  const nameChange = body.name !== template.name
  if (nameChange) {
    Mailings.updateMany(
      { _wireframe: templateId },
      { wireframe: body.name },
    ).then(result => {
      console.log(result.nModified, `mailings updated for`, userParams.name)
    })
  }
  await updatedTemplate.save()
  // make sure to have a fresh-well-formatted response
  const responseTemplate = await Templates.findById(templateId).populate({
    path: `_company`,
    select: `id name`,
  })
  res.json(responseTemplate)
}

/**
 * @api {del} /templates/:templateId template delete
 * @apiPermission admin
 * @apiName DeleteTemplate
 * @apiGroup Templates
 *
 * @apiParam {string} templateId
 *
 * @apiSuccess {String} id the deleted template ID
 *
 */

async function destroy(req, res) {
  const { templateId } = req.params
  // for gallery deletion we will need the mailings Ids
  // → this query is required :S
  const mailings = await Mailings.find({ _wireframe: templateId })
    .select({ _id: 1 })
    .lean()
  const mailingsId = mailings.map(mailing => mailing._id)
  // Mongo responseFormat
  // { n: 1, ok: 1, deletedCount: 1 }
  const [mailingDeletionResult, galleryDeletionResult] = await Promise.all([
    Mailings.deleteMany({ _wireframe: templateId }),
    Galleries.deleteMany({
      creationOrWireframeId: { $in: mailingsId },
    }),
  ])
  logger.info({
    mailingDeletionResult,
    galleryDeletionResult,
  })
  await Templates.findByIdAndRemove(templateId)
  res.json({ id: templateId })
}

/**
 * @api {del} /templates/:templateId template images reset
 * @apiPermission admin
 * @apiName DestroyTemplateImages
 * @apiDescription reset all images
 * @apiGroup Templates
 *
 * @apiParam {string} templateId
 *
 * @apiUse template
 */

async function destroyImages(req, res) {
  const { templateId } = req.params
  const template = await Templates.findById(templateId)
  if (!template) throw createError(404)
  if (template.assets) {
    template.assets = {}
    // we don't remove images on storage
    // we just empty the assets field
    // This could prevent old mailing to still access images
    template.markModified(`assets`)
    await template.save()
  }
  const updatedTemplate = await Templates.findById(templateId).populate({
    path: `_company`,
    select: `id name`,
  })
  res.json(updatedTemplate)
}
