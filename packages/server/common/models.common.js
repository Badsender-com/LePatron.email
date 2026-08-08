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
const { CommentSchema } = require('../comment/comment.schema.js');
const IntegrationSchema = require('../integration/integration.schema.js');
const DashboardSchema = require('../dashboard/dashboard.schema.js');
const AIFeatureConfigSchema = require('../ai-feature/ai-feature.schema.js');
const LePatronSkillSchema = require('../ai-skill/models/le-patron-skill.schema.js');
const ExpertiseSchema = require('../ai-skill/models/expertise.schema.js');
const AISkillInvocationSchema = require('../ai-skill/models/ai-skill-invocation.schema.js');
const AIPlaygroundScenarioSchema = require('../ai-playground/models/ai-playground-scenario.schema.js');
const AIPlaygroundRunSchema = require('../ai-playground/models/ai-playground-run.schema.js');
const TranslationJobSchema = require('../translation/translation-job.schema.js');
const FeedMappingSchema = require('../feed-mapping/feed-mapping.schema.js');

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
const Comments = mongoose.model(modelNames.CommentModel, CommentSchema);
const Integrations = mongoose.model(
  modelNames.IntegrationModel,
  IntegrationSchema
);
const Dashboards = mongoose.model(modelNames.DashboardModel, DashboardSchema);
const AIFeatureConfigs = mongoose.model(
  modelNames.AIFeatureConfigModel,
  AIFeatureConfigSchema
);
const LePatronSkills = mongoose.model(
  modelNames.LePatronSkillModel,
  LePatronSkillSchema
);
const Expertises = mongoose.model(modelNames.ExpertiseModel, ExpertiseSchema);
const AISkillInvocations = mongoose.model(
  modelNames.AISkillInvocationModel,
  AISkillInvocationSchema
);
const AIPlaygroundScenarios = mongoose.model(
  modelNames.AIPlaygroundScenarioModel,
  AIPlaygroundScenarioSchema
);
const AIPlaygroundRuns = mongoose.model(
  modelNames.AIPlaygroundRunModel,
  AIPlaygroundRunSchema
);
const TranslationJobs = mongoose.model(
  modelNames.TranslationJobModel,
  TranslationJobSchema
);
const FeedMappings = mongoose.model(
  modelNames.FeedMappingModel,
  FeedMappingSchema
);

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
  Comments,
  Integrations,
  Dashboards,
  AIFeatureConfigs,
  LePatronSkills,
  Expertises,
  AISkillInvocations,
  AIPlaygroundScenarios,
  AIPlaygroundRuns,
  TranslationJobs,
  FeedMappings,
};
