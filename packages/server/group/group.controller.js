'use strict'

const createError = require('http-errors')
const asyncHandler = require('express-async-handler')

const {
  Groups,
  Users,
  Templates,
  Mailings,
} = require('../common/models.common.js')

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
  read: asyncHandler(read),
  readUsers: asyncHandler(readUsers),
  readTemplates: asyncHandler(readTemplates),
  readMailings: asyncHandler(readMailings),
  update: asyncHandler(update),
}

/**
 * @api {get} /groups list of groups
 * @apiPermission admin
 * @apiName GetGroups
 * @apiGroup Groups
 *
 * @apiUse group
 * @apiSuccess {group[]} items list of groups
 */

async function list(req, res) {
  const groups = await Groups.find({}).sort({ name: 1 })
  res.json({ items: groups })
}

/**
 * @api {post} /groups group creation
 * @apiPermission admin
 * @apiName CreateGroup
 * @apiGroup Groups
 *
 * @apiParam (Body) {String} name
 * @apiParam (Body) {Boolean} downloadMailingWithoutEnclosingFolder if we want to zip with an enclosing folder
 * @apiParam (Body) {Boolean} downloadMailingWithCdnImages if the images path of the downloaded archive should point to a CDN
 * @apiParam (Body) {String} [cdnProtocol] the protocol of the CDN
 * @apiParam (Body) {String} [cdnEndPoint] the CDN endpoint
 * @apiParam (Body) {String} [cdnButtonLabel] what will be the label of the `download CDN` button on the interface
 * @apiParam (Body) {Boolean} [downloadMailingWithFtpImages] if the images path of the downloaded archive should point to a FTP
 * @apiParam (Body) {String} [ftpProtocol] the FTP protocol, only sftp is currently supported (default: sftp)
 * @apiParam (Body) {String} [ftpHost] the FTP host
 * @apiParam (Body) {String} [ftpUsername] the FTP username
 * @apiParam (Body) {String} [ftpPassword] the FTP password
 * @apiParam (Body) {Number} [ftpPort] the FTP port (default: 22)
 * @apiParam (Body) {String} [ftpEndPoint] the FTP endpoint url to retrieve images
 * @apiParam (Body) {String} [ftpEndPointProcotol] the FTP endpoint protocol
 * @apiParam (Body) {String} [ftpPathOnServer] the FTP path folder where we will save images
 *
 * @apiUse group
 */

async function create(req, res) {
  const newGroup = await Groups.create(req.body)
  res.json(newGroup)
}

/**
 * @api {get} /groups/:groupId group
 * @apiPermission admin
 * @apiName GetGroup
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse group
 */

async function read(req, res) {
  const { groupId } = req.params
  const group = await Groups.findById(groupId)
  if (!group) throw new createError.NotFound()
  res.json(group)
}

/**
 * @api {get} /groups/:groupId/users group users
 * @apiPermission admin
 * @apiName GetGroupUsers
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse users
 * @apiSuccess {users[]} items list of users
 */

async function readUsers(req, res) {
  const { groupId } = req.params
  const [group, users] = await Promise.all([
    Groups.findById(groupId).select(`_id`),
    Users.find({
      _company: groupId,
      isDeactivated: { $ne: true },
    })
    .populate({ path: `_company`, select: `id name entryPoint issuer` })
    .sort({ email: 1 }),
  ])
  if (!group) throw new createError.NotFound()
  res.json({ items: users })
}

/**
 * @api {get} /groups/:groupId/templates group templates
 * @apiPermission admin
 * @apiName GetGroupTemplates
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse templates
 * @apiSuccess {templates[]} items list of templates
 */

async function readTemplates(req, res) {
  const { groupId } = req.params
  const [group, templates] = await Promise.all([
    Groups.findById(groupId).select(`_id`),
    Templates.findForApi({ _company: groupId }),
  ])
  if (!group) throw new createError.NotFound()
  res.json({ items: templates })
}

/**
 * @api {get} /groups/:groupId/mailings group mailings
 * @apiPermission admin
 * @apiName GetGroupMailings
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse mailings
 * @apiSuccess {mailings[]} items list of mailings
 */

async function readMailings(req, res) {
  const { groupId } = req.params
  const [group, mailings] = await Promise.all([
    Groups.findById(groupId).select(`_id`),
    Mailings.findForApi({ _company: groupId }),
  ])
  if (!group) throw new createError.NotFound()
  res.json({ items: mailings })
}

/**
 * @api {put} /groups/:groupId group update
 * @apiPermission admin
 * @apiName UpdateGroup
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 * @apiParam (Body) {String} name
 * @apiParam (Body) {Boolean} downloadMailingWithoutEnclosingFolder if we want to zip with an enclosing folder
 * @apiParam (Body) {Boolean} downloadMailingWithCdnImages if the images path of the downloaded archive should point to a CDN
 * @apiParam (Body) {String} [cdnProtocol] the protocol of the CDN
 * @apiParam (Body) {String} [cdnEndPoint] the CDN endpoint
 * @apiParam (Body) {String} [cdnButtonLabel] what will be the label of the `download CDN` button on the interface
 * @apiParam (Body) {Boolean} [downloadMailingWithFtpImages] if the images path of the downloaded archive should point to a FTP
 * @apiParam (Body) {String} [ftpProtocol] the FTP protocol, only sftp is currently supported (default: sftp)
 * @apiParam (Body) {String} [ftpHost] the FTP host
 * @apiParam (Body) {String} [ftpUsername] the FTP username
 * @apiParam (Body) {String} [ftpPassword] the FTP password
 * @apiParam (Body) {Number} [ftpPort] the FTP port (default: 22)
 * @apiParam (Body) {String} [ftpEndPoint] the FTP endpoint url to retrieve images
 * @apiParam (Body) {String} [ftpEndPointProcotol] the FTP endpoint protocol
 * @apiParam (Body) {String} [ftpPathOnServer] the FTP path folder where we will save images
 *
 * @apiUse group
 */

async function update(req, res) {
  const { groupId } = req.params
  const updatedGroup = await Groups.findByIdAndUpdate(groupId, req.body, {
    runValidators: true,
  })
  res.json(updatedGroup)
}
