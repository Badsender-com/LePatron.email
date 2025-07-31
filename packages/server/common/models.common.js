'use strict';

const mongoose = require('mongoose');

mongoose.Promise = global.Promise; // Use native promises

const modelNames = require('../constant/model.names.js');

const UserSchema = require('../user/user.schema.js');
const TemplateSchema = require('../template/template.schema.js');
const MailingSchema = require('../mailing/mailing.schema.js');
const ProfileSchema = require('../profile/profile.schema.js');
const GroupSchema = require('../group/group.schema.js');
const CacheImageSchema = require('../image/image-cache.schema.js');
const GallerySchema = require('../image/gallery.schema.js');
const OAuthClientsSchema = require('../account/oauth-clients.schema.js');
const OAuthTokensSchema = require('../account/oauth-tokens.schema.js');
const OAuthCodesSchema = require('../account/oauth-codes.schema.js');
const EmailsGroupSchema = require('../emails-group/emails-group.schema');
const PersonalizedVariableSchema = require('../personalized-variables/personalized-variables.schema.js');
const FolderSchema = require('../folder/folder.schema');
const LogSchema = require('../log/log.schema');
const WorkspaceSchema = require('../workspace/workspace.schema');
const PersonalizedBlockSchema = require('../personalized-blocks/personalized-block-schema.js');
const TagSchema = require('../tag/tag.schema.js');
/// ///
// EXPORTS
/// ///

const Users = mongoose.model(modelNames.UserModel, UserSchema);
const Templates = mongoose.model(modelNames.TemplateModel, TemplateSchema);
const Mailings = mongoose.model(modelNames.MailingModel, MailingSchema);
const Groups = mongoose.model(modelNames.GroupModel, GroupSchema);
const Folders = mongoose.model(modelNames.FolderModel, FolderSchema);
const Logs = mongoose.model(modelNames.LogModel, LogSchema);
const EmailsGroups = mongoose.model(
  modelNames.EmailsGroupModal,
  EmailsGroupSchema
);
const PersonalizedVariables = mongoose.model(
  modelNames.PersonalizedVariablesModel,
  PersonalizedVariableSchema
);
const PersonalizedBlocks = mongoose.model(
  modelNames.PersonalizedBlocksModel,
  PersonalizedBlockSchema
);
const Workspaces = mongoose.model(modelNames.WorkspaceModel, WorkspaceSchema);
const Profiles = mongoose.model(modelNames.ProfileModel, ProfileSchema);
const CacheImages = mongoose.model(
  modelNames.CacheImageModel,
  CacheImageSchema
);
const Galleries = mongoose.model(modelNames.GalleryModel, GallerySchema);
const OAuthTokens = mongoose.model(modelNames.OAuthTokens, OAuthTokensSchema);
const OAuthClients = mongoose.model(
  modelNames.OAuthClients,
  OAuthClientsSchema
);
const OAuthCodes = mongoose.model(modelNames.OAuthCodes, OAuthCodesSchema);

const Tags = mongoose.model(modelNames.TagModel, TagSchema);

module.exports = {
  mongoose,
  // Compiled schema
  Users,
  Folders,
  Logs,
  EmailsGroups,
  PersonalizedVariables,
  PersonalizedBlocks,
  Workspaces,
  Templates,
  Mailings,
  Profiles,
  Groups,
  CacheImages,
  Galleries,
  OAuthTokens,
  OAuthClients,
  OAuthCodes,
  Tags,
};
