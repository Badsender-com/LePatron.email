'use strict';

const { omit } = require('lodash');
const mongoose = require('mongoose');
const {
  NotFound,
  InternalServerError,
  UnprocessableEntity,
  BadRequest,
  Forbidden,
} = require('http-errors');

const {
  Mailings,
  Workspaces,
  Galleries,
  Folders,
  Groups,
} = require('../common/models.common.js');

const _ = require('lodash');

const {
  getName,
  getImageName,
  createCdnMarkdownNotice,
  createHtmlNotice,
} = require('../utils/download-zip-markdown');

const IMAGES_FOLDER = 'images';

const createPromise = require('../helpers/create-promise.js');
const processMosaicoHtmlRender = require('../utils/process-mosaico-html-render.js');
const Ftp = require('./ftp-client.service.js');

const request = require('request');
const createError = require('http-errors');

const fileManager = require('../common/file-manage.service.js');
const modelsUtils = require('../utils/model.js');
const logger = require('../utils/logger.js');

const simpleI18n = require('../helpers/server-simple-i18n.js');
const ERROR_CODES = require('../constant/error-codes.js');

const templateService = require('../template/template.service.js');
const folderService = require('../folder/folder.service.js');
const workspaceService = require('../workspace/workspace.service.js');

module.exports = {
  createMailing,
  findMailings,
  findTags,
  findOne,
  renameMailing,
  deleteMailing,
  deleteOne,
  copyMailing,
  moveMailing,
  moveManyMailings,
  findAllIn,
  createInsideWorkspaceOrFolder,
  listMailingForWorkspaceOrFolder,
  previewMail,
  downloadZip,
  validateMailExist,
  processHtmlWithFTPOption,
  updateMailEspIds,
};

async function listMailingForWorkspaceOrFolder({
  workspaceId,
  parentFolderId,
  user,
}) {
  checkEitherWorkspaceOrFolderDefined(workspaceId, parentFolderId);
  let workspace;
  let mailings;
  let group;

  if (parentFolderId) {
    workspace = await folderService.getWorkspaceForFolder(parentFolderId);
    group = await Groups.findById(workspace.group);
  } else {
    workspace = await workspaceService.getWorkspace(workspaceId);
    group = await Groups.findById(workspace.group);
  }

  if (!user.isGroupAdmin) {
    if (
      await workspaceService.restrictAccessingWorkspacesForNonMemberUser(
        workspace,
        user,
        group
      )
    ) {
      throw new NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
    }
  }

  if (parentFolderId) {
    mailings = await findMailings({ parentFolderId, user });
  } else {
    mailings = await findMailings({ workspaceId, user });
  }

  const tags = await findTags({ user });

  return {
    meta: { tags },
    items: mailings,
  };
}

function checkEitherWorkspaceOrFolderDefined(workspaceId, parentFolderId) {
  if (!workspaceId && !parentFolderId) {
    throw new BadRequest(ERROR_CODES.PARENT_NOT_PROVIDED);
  }

  if (workspaceId && parentFolderId) {
    throw new BadRequest(ERROR_CODES.TWO_PARENTS_PROVIDED);
  }
}

async function updateMailEspIds(mailingId, espId) {
  await validateMailExist(mailingId);

  if (!espId?.profileId || !espId?.mailCampaignId) {
    throw new InternalServerError(ERROR_CODES.MISSING_PROPERTIES_ESP_ID);
  }
  const mailing = findOne(mailingId);

  const mailEspIds = [...(mailing?.espIds || [])];
  mailEspIds.push(espId);

  return Mailings.updateOne(
    { _id: mongoose.Types.ObjectId(mailingId) },
    { espIds: mailEspIds }
  );
}

async function findMailings(query) {
  const mailingQuery = applyFilters(query);

  return Mailings.find(mailingQuery, { previewHtml: 0, data: 0 });
}

async function findTags(query) {
  const mailingQuery = applyFilters(query);

  return Mailings.findTags(mailingQuery);
}

async function findOne(mailingId) {
  await validateMailExist(mailingId);
  return Mailings.findOne({ _id: mongoose.Types.ObjectId(mailingId) });
}

// create a mail inside a workspace or a folder ( depending on the parameters provided )
async function createInsideWorkspaceOrFolder(mailingData) {
  const {
    templateId,
    workspaceId,
    parentFolderId,
    mailingName,
    user,
  } = mailingData;

  checkCreationPayload({
    templateId,
    workspaceId,
    parentFolderId,
    mailingName,
  });

  const template = await templateService.findOne({ templateId });
  templateService.doesUserHaveAccess(user, template);

  let mailParentParam = null;

  if (workspaceId) {
    await workspaceService.hasAccess(user, workspaceId);

    mailParentParam = { workspace: workspaceId };
  }

  if (parentFolderId) {
    await folderService.hasAccess(parentFolderId, user);

    mailParentParam = { _parentFolder: parentFolderId };
  }

  const mailing = {
    // Always give a default name: needed for ordering & filtering
    name: mailingName || simpleI18n('default-mailing-name', user.lang),
    templateId: template._id,
    templateName: template.name,
    ...mailParentParam,
  };

  // admin doesn't have valid user id & company
  if (!user.isAdmin) {
    mailing.userId = user.id;
    mailing.userName = user.name;
    mailing.group = user.group.id;
  }

  const newMailing = await createMailing(mailing);

  // strangely toJSON doesn't render the data object
  // • cope with that by manually copy it in the response
  const response = newMailing.toJSON();
  response.data = newMailing.data;

  return response;
}

function checkCreationPayload(mailings) {
  const { templateId, workspaceId, parentFolderId, mailingName } = mailings;

  if (!mailingName || mailingName === '') {
    throw new BadRequest(ERROR_CODES.NAME_NOT_PROVIDED);
  }

  if (!templateId || templateId === '') {
    throw new BadRequest(ERROR_CODES.TEMPLATE_NOT_PROVIDED);
  }

  checkEitherWorkspaceOrFolderDefined(workspaceId, parentFolderId);
}

async function createMailing(mailing) {
  if (!mailing?._parentFolder && !mailing?.workspace) {
    throw new NotFound(ERROR_CODES.PARENT_NOT_PROVIDED);
  }

  if (
    mailing?.workspace &&
    !Workspaces.exists({ _id: mongoose.Types.ObjectId(mailing.workspace) })
  ) {
    throw new NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
  }

  if (
    mailing?._parentFolder &&
    !Folders.exists({ _id: mongoose.Types.ObjectId(mailing._parentFolder) })
  ) {
    throw new NotFound(ERROR_CODES.FOLDER_NOT_FOUND);
  }

  return Mailings.create(mailing);
}

// Process html to the final result state based on ftp
async function processHtmlWithFTPOption({ mailingId, html, user }) {
  const {
    cdnDownload,
    regularDownload,
    prefix,
    ftpEndPointProtocol,
    ftpEndPoint,
    ftpHost,
    ftpPort,
    ftpUsername,
    ftpPassword,
    ftpProtocol,
    ftpPathOnServer,
    cdnProtocol,
    cdnEndPoint,
    name,
  } = await extractFTPparams({
    mailingId,
    user,
    downloadOptions: {
      downLoadForCdn: false,
      downLoadForFtp: true,
    },
  });

  if (cdnDownload || regularDownload) {
    throw new InternalServerError(
      ERROR_CODES.CONFLICT_CDN_AND_REGULAR_DOWNLOAD_VALUES
    );
  }

  const { relativesImagesNames } = await handleRelativeOrFtpImages({
    html,
    cdnDownload,
    regularDownload,
    prefix,
    ftpHost,
    ftpPort,
    ftpUsername,
    ftpPassword,
    ftpProtocol,
    ftpPathOnServer,
  });

  // Add html with relatives url
  const processedHtml = processMosaicoHtmlRender(html);

  const {
    html: processedHtmlWithFtpAbsolutePathImages,
  } = replaceImageWithFTPEndpointBaseInProcessedHtml({
    cdnDownload,
    cdnProtocol,
    cdnEndPoint,
    ftpEndPointProtocol,
    ftpEndPoint,
    processedHtml,
    relativesImagesNames,
    name,
  });

  return processedHtmlWithFtpAbsolutePathImages;
}

// This will handle downloading email as a ZIP file
async function downloadZip({
  mailingId,
  html,
  archive,
  user,
  downloadOptions,
}) {
  if (!archive) {
    throw new InternalServerError(ERROR_CODES.ARCHIVE_IS_NULL);
  }

  const {
    cdnDownload,
    regularDownload,
    prefix,
    ftpEndPointProtocol,
    ftpEndPoint,
    ftpHost,
    ftpPort,
    ftpUsername,
    ftpPassword,
    ftpProtocol,
    ftpPathOnServer,
    cdnProtocol,
    cdnEndPoint,
    name,
  } = await extractFTPparams({
    mailingId,
    user,
    downloadOptions,
  });

  const {
    relativesImagesNames,
    archive: processedImageArchive,
  } = await handleRelativeOrFtpImages({
    html,
    cdnDownload,
    regularDownload,
    archive,
    prefix,
    ftpHost,
    ftpPort,
    ftpUsername,
    ftpPassword,
    ftpProtocol,
    ftpPathOnServer,
    name,
  });
  // ----- HTML

  // Add html with relatives url
  const processedHtml = processMosaicoHtmlRender(html);

  if (regularDownload) {
    processedImageArchive.append(processedHtml, {
      prefix,
      name: `${name}.html`,
    });
  } else {
    // replace image with absolute url

    const {
      html,
      endpointPath,
    } = replaceImageWithFTPEndpointBaseInProcessedHtml({
      cdnDownload,
      cdnProtocol,
      cdnEndPoint,
      ftpEndPointProtocol,
      ftpEndPoint,
      processedHtml,
      relativesImagesNames,
      name,
    });
    // archive
    processedImageArchive.append(html, {
      prefix,
      name: `${name}.html`,
    });

    if (cdnDownload) {
      // notice
      const CDN_MD_NOTICE = createCdnMarkdownNotice(
        name,
        endpointPath,
        relativesImagesNames
      );
      processedImageArchive.append(CDN_MD_NOTICE, {
        prefix,
        name: 'notice.md',
      });
      const CDN_HTML_NOTICE = createHtmlNotice(
        name,
        endpointPath,
        relativesImagesNames
      );
      processedImageArchive.append(CDN_HTML_NOTICE, {
        prefix,
        name: 'notice.html',
      });
    }
  }

  return { archive: processedImageArchive, name };
}

// Extract information related to ftp and download state based on mailing id, user and download options
async function extractFTPparams({ mailingId, user, downloadOptions }) {
  const query = modelsUtils.addGroupFilter(user, { _id: mailingId });
  // mailing can come without group if created by the admin
  // • in order to retrieve the group, look at the wireframe
  const mailing = await Mailings.findOne(query)
    .select({ _wireframe: 1, name: 1 })
    .populate('_wireframe');
  if (!mailing) throw new createError.NotFound();

  // if (!isFromCompany(user, mailing._company)) throw new createError.Unauthorized()

  // group is needed to check zip format & DL configuration
  const group = await Groups.findById(mailing._wireframe._company).lean();
  if (!group) throw new createError.NotFound();

  const {
    downloadMailingWithoutEnclosingFolder,
    downloadMailingWithCdnImages,
    cdnProtocol,
    cdnEndPoint,
    downloadMailingWithFtpImages,
    ftpProtocol,
    ftpHost,
    ftpUsername,
    ftpPassword,
    ftpPort,
    ftpEndPoint,
    ftpEndPointProtocol,
    ftpPathOnServer,
  } = group;

  // Because this is cans come as a real from submit
  // downLoadForCdn & downLoadForFtp might come as a string
  downloadOptions.downLoadForCdn =
    downloadOptions.downLoadForCdn === 'true' ||
    downloadOptions.downLoadForCdn === true;

  downloadOptions.downLoadForFtp =
    downloadOptions.downLoadForFtp === 'true' ||
    downloadOptions.downLoadForFtp === true;

  if (
    downloadOptions.downLoadForFtp &&
    (!ftpHost || !ftpUsername || !ftpPassword || !ftpEndPoint)
  ) {
    throw new InternalServerError(ERROR_CODES.FTP_NOT_DEFINED_FOR_GROUP);
  }

  const name = getName(mailing.name);
  // prefix is `zip-stream` file prefix => our enclosing folder ^_^
  // !WARNING default mac unzip will always put it in an folder if more than 1 file
  // => test with The Unarchiver
  const prefix = downloadMailingWithoutEnclosingFolder ? '' : `${name}/`;

  // const $ = cheerio.load(html)

  const cdnDownload =
    downloadMailingWithCdnImages && downloadOptions.downLoadForCdn;
  const ftpDownload =
    downloadMailingWithFtpImages && downloadOptions.downLoadForFtp;
  const regularDownload = !cdnDownload && !ftpDownload;

  console.log('download zip', name);
  // Image
  return {
    cdnDownload,
    regularDownload,
    prefix,
    ftpEndPointProtocol,
    ftpEndPoint,
    ftpHost,
    ftpPort,
    ftpUsername,
    ftpPassword,
    ftpProtocol,
    ftpPathOnServer,
    cdnProtocol,
    cdnEndPoint,
    name,
  };
}

async function replaceImageWithFTPEndpointBaseInProcessedHtml({
  cdnDownload,
  cdnProtocol,
  cdnEndPoint,
  ftpEndPointProtocol,
  ftpEndPoint,
  processedHtml,
  relativesImagesNames,
  name,
}) {
  const endpointBase = cdnDownload
    ? `${cdnProtocol}${cdnEndPoint}`
    : `${ftpEndPointProtocol}${ftpEndPoint}`;
  const endpointPath = `${endpointBase}${
    endpointBase.substr(endpointBase.length - 1) === '/' ? '' : '/'
  }${name}`;
  let html = processedHtml;

  relativesImagesNames.forEach((imageName) => {
    const imgRegex = new RegExp(`${IMAGES_FOLDER}/${imageName}`, 'g');
    html = html.replace(imgRegex, `${endpointPath}/${imageName}`);
  });

  return { html, endpointBase };
}

// This will either add images to archive ( zip file ) or upload an image depending on the value of the cdnDownload and regularDownload
async function handleRelativeOrFtpImages({
  html,
  cdnDownload,
  regularDownload,
  archive,
  prefix,
  ftpHost,
  ftpPort,
  ftpUsername,
  ftpPassword,
  ftpProtocol,
  ftpPathOnServer,
  name,
}) {
  if (!html) {
    throw new InternalServerError(ERROR_CODES.HTML_IS_NULL);
  }

  if ((cdnDownload || regularDownload) && !archive) {
    throw new InternalServerError(ERROR_CODES.ARCHIVE_IS_NULL);
  }
  // ----- IMAGES

  // keep a track of every images for latter download
  // be careful to avoid data uri
  // relatives path are not handled:
  //  - the mailing should work also by email test
  //  - SO no need to handle them
  // const $images = $(`img`)
  // const imgUrls = _.uniq(
  //   $images
  //     .map((i, el) => $(el).attr(`src`))
  //     .get()
  //     .filter(isHttpUrl),
  // )
  // const $background = $(`[background]`)
  // const bgUrls = _.uniq(
  //   $background
  //     .map((i, el) => $(el).attr(`background`))
  //     .get()
  //     .filter(isHttpUrl),
  // )
  // const $style = $(`[style]`)
  // const styleUrls = []
  // $style
  //   .filter((i, el) => /url\(/.test($(el).attr(`style`)))
  //   .each((i, el) => {
  //     const urlReg = /url\('?([^)']*)/
  //     const style = $(el).attr(`style`)
  //     const result = urlReg.exec(style)
  //     if (
  //       result &&
  //       result[1] &&
  //       isHttpUrl(result[1]) &&
  //       !styleUrls.includes(result[1])
  //     ) {
  //       styleUrls.push(result[1])
  //     }
  //   })

  const remainingUrlsRegex = /https?:\S+\.(jpg|jpeg|png|gif){1}/g;
  const allImages = html.match(remainingUrlsRegex) || [];

  // const allImages = _.uniq([...imgUrls, ...bgUrls, ...styleUrls])
  // console.log(remainingUrls, allImages)

  // keep a dictionary of all downloaded images
  // • this will help us for CDN images
  const relativesImagesNames = [];
  // change path to match downloaded images
  // Don't use Cheerio because:
  // • when exporting it's messing with ESP tags
  // • Cheerio won't handle IE comments
  allImages.forEach((imgUrl) => {
    const escImgUrl = _.escapeRegExp(imgUrl);
    const imageName = getImageName(imgUrl);
    const relativeUrl = `${IMAGES_FOLDER}/${imageName}`;
    relativesImagesNames.push(imageName);
    console.log(imgUrl, relativeUrl);
    const search = new RegExp(escImgUrl, 'g');
    html = html.replace(search, relativeUrl);
  });

  // Pipe all images BUT don't add errored images
  if (cdnDownload || regularDownload) {
    const imagesRequest = allImages.map((imageUrl) => {
      const imageName = getImageName(imageUrl);
      const defer = createPromise();
      const imgRequest = request(imageUrl);

      imgRequest.on('response', (response) => {
        // only happen images with a code of 200
        if (response.statusCode === 200) {
          archive.append(imgRequest, {
            prefix: `${prefix}${IMAGES_FOLDER}/`,
            name: imageName,
          });
        }
        defer.resolve();
      });
      imgRequest.on('error', (imgError) => {
        console.log('[ZIP] error during downloading', imageUrl);
        console.log(imgError);
        // still resolve, just don't add this errored image to the archive
        defer.resolve();
      });

      return defer;
    });

    await Promise.all(imagesRequest);
  } else {
    const ftpClient = new Ftp(
      ftpHost,
      ftpPort,
      ftpUsername,
      ftpPassword,
      ftpProtocol
    );
    const folderPath =
      ftpPathOnServer +
      (ftpPathOnServer.substr(ftpPathOnServer.length - 1) === '/' ? '' : '/') +
      `${name}/`;

    ftpClient.upload(allImages, folderPath);
  }

  return { relativesImagesNames, archive };
}

async function copyMailing(mailingId, destination, user) {
  const { workspaceId, folderId } = destination;

  checkEitherWorkspaceOrFolderDefined(workspaceId, folderId);

  const mailing = await findOne(mailingId);

  if (mailing?._parentFolder) {
    await folderService.hasAccess(mailing._parentFolder, user);
  }

  if (mailing?.workspace) {
    const sourceWorkspace = await workspaceService.getWorkspace(
      mailing.workspace
    );
    workspaceService.doesUserHaveReadAccess(user, sourceWorkspace);
  }

  const copy = omit(mailing, [
    '_id',
    'createdAt',
    'updatedAt',
    '_user',
    'author',
    '_workspace',
    'workspace',
    '_parentFolder',
  ]);

  if (workspaceId) {
    const destination = await workspaceService.getWorkspace(workspaceId);
    workspaceService.doesUserHaveWriteAccess(user, destination);

    copy._workspace = destination;
  } else {
    await folderService.hasAccess(folderId, user);

    const destination = await folderService.getFolder(folderId);
    copy._parentFolder = destination;
  }

  if (user.id) {
    copy._user = user._id;
    copy.author = user.name;
  }

  const copiedMailing = await Mailings.create(copy);
  const gallery = await Galleries.findOne({
    creationOrWireframeId: mailing._id,
  });

  await fileManager.copyImages(
    mailing._id?.toString(),
    copiedMailing._id?.toString()
  );
  await copiedMailing.save();

  try {
    if (gallery) {
      gallery.duplicate(copiedMailing._id).save();
    }
  } catch (error) {
    logger.warn(
      `MAILING DUPLICATE – can't duplicate gallery for ${copiedMailing._id}`
    );
  }
}

async function renameMailing(
  { mailingId, mailingName, workspaceId, parentFolderId },
  user
) {
  if (!mailingName || mailingName === '') {
    throw new BadRequest(ERROR_CODES.NAME_NOT_PROVIDED);
  }

  checkEitherWorkspaceOrFolderDefined(workspaceId, parentFolderId);

  if (workspaceId) {
    const workspace = await workspaceService.getWorkspace(workspaceId);
    workspaceService.doesUserHaveWriteAccess(user, workspace);
  } else {
    await folderService.hasAccess(parentFolderId, user);
  }

  const updateResponse = await Mailings.updateOne(
    { _id: mongoose.Types.ObjectId(mailingId) },
    { name: mailingName }
  );

  if (updateResponse.ok !== 1) {
    throw new InternalServerError(ERROR_CODES.FAILED_MAILING_RENAME);
  }
}

async function deleteOne(mailing) {
  return Mailings.deleteOne({ _id: mongoose.Types.ObjectId(mailing.id) });
}

async function previewMail(mailingId) {
  const mailWithPreview = await Mailings.findById(mailingId, {
    previewHtml: 1,
  }).lean();
  if (!mailWithPreview) throw new NotFound(ERROR_CODES.MAILING_NOT_FOUND);
  if (!mailWithPreview.previewHtml)
    throw new NotFound(ERROR_CODES.MAILING_NOT_FOUND);
  return mailWithPreview.previewHtml;
}

async function deleteMailing({ mailingId, workspaceId, parentFolderId, user }) {
  checkEitherWorkspaceOrFolderDefined(workspaceId, parentFolderId);

  if (parentFolderId) {
    await folderService.hasAccess(parentFolderId, user);
  }

  if (workspaceId) {
    await workspaceService.hasAccess(user, workspaceId);
  }

  const mailing = await findOne(mailingId);

  if (
    mailing?._workspace?.toString() !== workspaceId &&
    mailing?._parentFolder?.toString() !== parentFolderId
  ) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_MAILING_DELETE);
  }

  const deleteResponse = await deleteOne(mailing);

  if (deleteResponse.ok !== 1) {
    throw new InternalServerError(ERROR_CODES.FAILED_MAILING_DELETE);
  }

  return deleteResponse;
}
async function moveMailing(user, mailing, workspaceId, parentFolderId) {
  checkEitherWorkspaceOrFolderDefined(workspaceId, parentFolderId);
  let sourceWorkspace;
  let destinationWorkspace;
  let queryMovingParams;

  if (mailing?._parentFolder) {
    sourceWorkspace = await folderService.getWorkspaceForFolder(
      mailing._parentFolder
    );
  }

  if (mailing?._workspace) {
    sourceWorkspace = await workspaceService.getWorkspace(mailing._workspace);
  }

  if (parentFolderId) {
    destinationWorkspace = await folderService.getWorkspaceForFolder(
      parentFolderId
    );

    queryMovingParams = {
      _parentFolder: parentFolderId,
      _workspace: null,
    };
  }

  if (workspaceId) {
    destinationWorkspace = await workspaceService.getWorkspace(workspaceId);
    queryMovingParams = {
      _parentFolder: null,
      _workspace: workspaceId,
    };
  }

  workspaceService.doesUserHaveWriteAccess(user, sourceWorkspace);
  workspaceService.doesUserHaveWriteAccess(user, destinationWorkspace);

  const moveResponse = await Mailings.updateOne(
    { _id: mongoose.Types.ObjectId(mailing.id) },
    queryMovingParams
  );

  // update queries return objects with format { n, nModified, ok }
  // ok != 1 indicates a failure
  if (moveResponse.ok !== 1) {
    throw new InternalServerError(ERROR_CODES.FAILED_MAILING_MOVE);
  }
}

async function findAllIn(mailingsIds) {
  const mailings = await Mailings.find({
    _id: { $in: mailingsIds.map((id) => mongoose.Types.ObjectId(id)) },
  });

  if (mailings.length !== mailingsIds.length) {
    throw new NotFound(ERROR_CODES.MAILING_NOT_FOUND);
  }

  return mailings;
}

async function checkAccessMailingsSource(mailings, user) {
  for (const mailing of mailings) {
    if (!mailing._workspace && !mailing._parentFolder) {
      throw new UnprocessableEntity(ERROR_CODES.MAILING_MISSING_SOURCE);
    }

    if (mailing._workspace) {
      const sourceWorkspace = await workspaceService.getWorkspace(
        mailing._workspace
      );
      workspaceService.doesUserHaveWriteAccess(user, sourceWorkspace);
    }

    if (mailing._parentFolder) {
      await folderService.hasAccess(mailing._parentFolder, user);
    }
  }
}

async function moveManyMailings(user, mailingsIds, destination) {
  const { workspaceId, parentFolderId } = destination;
  checkEitherWorkspaceOrFolderDefined(workspaceId, parentFolderId);

  // moving to a folder
  if (parentFolderId) {
    await folderService.hasAccess(parentFolderId, user);

    const mailings = await findAllIn(mailingsIds);
    await checkAccessMailingsSource(mailings, user);

    const moveResponse = await Mailings.updateMany(
      { _id: { $in: mailings.map((mailing) => mailing.id) } },
      {
        _parentFolder: mongoose.Types.ObjectId(parentFolderId),
        $unset: { _workspace: '' },
      }
    );

    if (moveResponse.ok !== 1) {
      throw new InternalServerError(ERROR_CODES.FAILED_MAILING_MOVE);
    }

    return;
  }

  // moving to a workspace
  if (workspaceId) {
    const destination = await workspaceService.getWorkspace(workspaceId);
    workspaceService.doesUserHaveWriteAccess(user, destination);

    const mailings = await findAllIn(mailingsIds);
    await checkAccessMailingsSource(mailings, user);

    const moveResponse = await Mailings.updateMany(
      { _id: { $in: mailings.map((mailing) => mailing.id) } },
      {
        _workspace: mongoose.Types.ObjectId(workspaceId),
        $unset: { _parentFolder: '' },
      }
    );

    if (moveResponse.ok !== 1) {
      throw new InternalServerError(ERROR_CODES.FAILED_MAILING_MOVE);
    }
  }
}

async function validateMailExist(mailingId) {
  if (!(await Mailings.exists({ _id: mongoose.Types.ObjectId(mailingId) }))) {
    throw new NotFound(ERROR_CODES.MAILING_NOT_FOUND);
  }
  return true;
}

function applyFilters(query) {
  const mailingQueryStrictGroup = modelsUtils.addStrictGroupFilter(
    query.user,
    {}
  );

  if (query.workspaceId) {
    return {
      ...mailingQueryStrictGroup,
      _workspace: query.workspaceId,
    };
  } else {
    return {
      ...mailingQueryStrictGroup,
      _parentFolder: query.parentFolderId,
    };
  }
}
