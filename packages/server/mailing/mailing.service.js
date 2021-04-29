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
} = require('../common/models.common.js');
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
};

async function listMailingForWorkspaceOrFolder({
  workspaceId,
  parentFolderId,
  user,
}) {
  checkEitherWorkspaceOrFolderDefined(workspaceId, parentFolderId);
  let workspace;
  let mailings;

  if (parentFolderId) {
    workspace = await folderService.getWorkspaceForFolder(parentFolderId);
  } else {
    workspace = await workspaceService.getWorkspace(workspaceId);
  }

  if (!user.isGroupAdmin) {
    if (
      !workspaceService.workspaceContainsUser(workspace, user) &&
      user.group.userHasAccessToAllWorkspaces === false
    ) {
      // Condition changed
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

async function findMailings(query) {
  const mailingQuery = applyFilters(query);

  return Mailings.find(mailingQuery, { previewHtml: 0, data: 0 });
}

async function findTags(query) {
  const mailingQuery = applyFilters(query);

  return Mailings.findTags(mailingQuery);
}

async function findOne(mailingId) {
  if (!(await Mailings.exists({ _id: mongoose.Types.ObjectId(mailingId) }))) {
    throw new NotFound(ERROR_CODES.MAILING_NOT_FOUND);
  }
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
