'use strict';

// we keep old collections name for compatibility issues
module.exports = Object.freeze({
  UserModel: 'User',
  TemplateModel: 'Wireframe',
  MailingModel: 'Creation',
  ProfileModel: 'Profile',
  GroupModel: 'Company',
  CacheImageModel: 'Cacheimage',
  FolderModel: 'Folder',
  LogModel: 'Log',
  EmailsGroupModal: 'EmailsGroup',
  PersonalizedVariablesModel: 'PersonalizedVariables',
  PersonalizedBlocksModel: 'PersonalizedBlocks',
  WorkspaceModel: 'Workspace',
  GalleryModel: 'Gallery',
  // Tags
  TagModel: 'Tag',
  // Comments
  CommentModel: 'Comment',
  // Integrations
  IntegrationModel: 'Integration',
  DashboardModel: 'Dashboard',
  AIFeatureConfigModel: 'AIFeatureConfig',
  FeedMappingModel: 'FeedMapping',
  // Translation
  TranslationJobModel: 'TranslationJob',
  // LePatron Skills IA
  LePatronSkillModel: 'LePatronSkill',
  ExpertiseModel: 'Expertise',
  AISkillInvocationModel: 'AISkillInvocation',
  // A copy following production (ADR 0019)
  SkillsReadTokenModel: 'SkillsReadToken',
  SkillsFollowModel: 'SkillsFollow',
  // AI Playground
  AIPlaygroundScenarioModel: 'AIPlaygroundScenario',
  AIPlaygroundRunModel: 'AIPlaygroundRun',
  // Taxonomy (email metadata)
  TaxonomyItemModel: 'TaxonomyItem',
  // Two-factor authentication (ADR 0008)
  SecurityEventModel: 'SecurityEvent',
  McpFeedbackModel: 'McpFeedback',
  McpCallLogModel: 'McpCallLog',
  McpClientModel: 'McpClient',
  McpConnectionModel: 'McpConnection',
  // The retex loop (ADR 0021)
  McpRetexModel: 'McpRetex',
  // Public preview links (quality drawer)
  ShareLinkModel: 'ShareLink',
  // Daily budgets of the paid quality lookups
  QualityBudgetModel: 'QualityBudget',
  // Rate limit of the AI features
  AIUsageCounterModel: 'AIUsageCounter',
});
