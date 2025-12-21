const API_PREFIX = process.env.API_PREFIX;

// a dictionary of API routes
// • prefix is configured by axios (/api)
// • it's just a way to centralize all our routes
//   since we don't use a store for everything

/// ///
// GROUPS
/// ///

export function groups() {
  return '/groups';
}
export function groupsItem(routeParams = {}) {
  return `/groups/${routeParams.groupId}`;
}
export function groupsItemUsers(routeParams = {}) {
  return `/groups/${routeParams.groupId}/users`;
}
export function groupsItemTemplates(routeParams = {}) {
  return `/groups/${routeParams.groupId}/templates`;
}
export function groupsItemMailings(routeParams = {}) {
  return `/groups/${routeParams.groupId}/mailings`;
}
export function groupsWorkspaces(routeParams = {}) {
  return `/groups/${routeParams.groupId}/workspaces`;
}

export function groupsProfiles(routeParams = {}) {
  return `/groups/${routeParams.groupId}/profiles`;
}

/// ///
// TEMPLATES
/// ///

export function templates() {
  return '/templates';
}
/**
 * @param {Object} routeParams
 * @param {string} routeParams.templateId
 */
export function templatesItem(routeParams = {}) {
  return `/templates/${routeParams.templateId}`;
}
export function templatesItemPreview(routeParams = {}) {
  return `/templates/${routeParams.templateId}/preview`;
}
export function templatesItemImages(routeParams = {}) {
  return `/templates/${routeParams.templateId}/images`;
}
// this is not used by axios (download/show)
export function templatesItemMarkup(routeParams = {}) {
  return `${API_PREFIX}/templates/${routeParams.templateId}/markup`;
}
// this is not used by axios (SSE with EventSource)
export function templatesItemEvents(routeParams = {}) {
  return `${API_PREFIX}/templates/${routeParams.templateId}/events`;
}

/// ///
// ACCOUNT
/// ///

export function getPublicProfile({ username }) {
  return `/account/${username}`;
}

export function login() {
  return '/account/login';
}

export function accountResetPassword(routeParams = {}) {
  return `/account/${routeParams.email}/password`;
}
export function accountSetPassword(routeParams = {}) {
  return `/account/${routeParams.email}/password/${routeParams.token}`;
}

/// ///
// USERS
/// ///

export function users() {
  return '/users';
}
export function usersItem(routeParams = {}) {
  return `/users/${routeParams.userId}`;
}
export function usersItemActivate(routeParams = {}) {
  return `/users/${routeParams.userId}/activate`;
}
export function usersItemPassword(routeParams = {}) {
  return `/users/${routeParams.userId}/password`;
}
export function usersItemMailings(routeParams = {}) {
  return `/users/${routeParams.userId}/mailings`;
}

/// ///
// MAILINGS
/// ///

export function mailings() {
  return '/mailings';
}
export function mailingsItem(routeParams = {}) {
  return `/mailings/${routeParams.mailingId}`;
}
export function mailingsItemDuplicate(routeParams = {}) {
  return `/mailings/${routeParams.mailingId}/duplicate`;
}
export function mailingsItemTransferToUser(routeParams = {}) {
  return `/mailings/${routeParams.mailingId}/transfer-to-user`;
}

export function copyMail() {
  return '/mailings/copy';
}

export function moveMail(routeParams = {}) {
  return `/mailings/${routeParams.mailingId}/move`;
}

export function moveManyMails() {
  return '/mailings/move-many';
}

export function preview(mailingId) {
  return `/mailings/${mailingId}/preview`;
}

export function downloadMultipleMails() {
  return '/mailings/download-multiple-zip';
}
/// ///
// IMAGES
/// ///

// this is not used by axios (show an image…)
export function imagesItem(routeParams = {}) {
  return `${API_PREFIX}/images/${routeParams.imageName}`;
}
export function imagesPlaceholder(routeParams = {}) {
  return `${API_PREFIX}/images/placeholder/${routeParams.width}x${routeParams.height}.png`;
}
export function imageFromPreviews(mailingId) {
  return `/mailings/${mailingId}/preview`;
}

/// ///
// WORKSPACEs
/// ///

export function workspacesByGroup() {
  return '/workspaces';
}

export function workspaceByNameInGroup(workspaceName) {
  return `/workspaces/name/${workspaceName}`;
}

export function deleteWorkspace(workspaceId) {
  return `/workspaces/${workspaceId}`;
}

export function getWorkspace(workspaceId) {
  return `/workspaces/${workspaceId}`;
}

export function getWorkspaceAccess(folderID) {
  return `/workspaces/${folderID}/has-access`;
}

/// ///
// FOLDERS
/// ///

export function folders() {
  return '/folders/';
}

export function moveFolder(folderID) {
  return `/folders/${folderID}/move`;
}

export function deleteFolder(folderId) {
  return `/folders/${folderId}`;
}

export function getFolder(folderID) {
  return `/folders/${folderID}`;
}

export function getFolderAccess(folderID) {
  return `/folders/${folderID}/has-access`;
}

/// ///
// PROFILES
/// ///

export function getProfiles() {
  return '/profiles';
}

export function getProfileId(getProfileId) {
  return `/profiles/${getProfileId}`;
}

export function getProfileForAdmin(getProfileId) {
  return `/profiles/${getProfileId}/admin`;
}

export function getTableTargetList() {
  return '/profiles/actito-target-tables-list';
}

export function getEntitiesList() {
  return '/profiles/actito-entities-list';
}

/// ///
// Email groups
/// ///

export function getEmailsGroups() {
  return '/emails-groups';
}

export function getEmailsGroup(emailsGroupId) {
  return `/emails-groups/${emailsGroupId}`;
}

/// ///
// Personalized Variables
/// ///

export function getPersonalizedVariables(groupId) {
  return `/groups/${groupId}/personalized-variables`;
}

export function deletePersonalizedVariable(groupId, variableId) {
  return `/groups/${groupId}/personalized-variables/${variableId}`;
}

export function postPersonalizedVariables(groupId) {
  return `/groups/${groupId}/personalized-variables`;
}

/// ///
// INTEGRATIONS
/// ///

export function integrations(groupId) {
  return `/integrations/groups/${groupId}`;
}

export function integrationsItem(integrationId) {
  return `/integrations/${integrationId}`;
}

export function integrationsValidate(integrationId) {
  return `/integrations/${integrationId}/validate`;
}

export function integrationsProviders() {
  return '/integrations/providers';
}

export function integrationModels(integrationId) {
  return `/integrations/${integrationId}/models`;
}

/// ///
// AI FEATURES
/// ///

export function aiFeatures(groupId) {
  return `/ai-features/groups/${groupId}`;
}

export function aiFeaturesItem(groupId, featureType) {
  return `/ai-features/groups/${groupId}/features/${featureType}`;
}

export function aiFeaturesTypes() {
  return '/ai-features/types';
}

/// ///
// TRANSLATION
/// ///

export function translationLanguages() {
  return '/translation/languages';
}

export function translationText() {
  return '/translation/text';
}

export function translationDetectLanguage(mailingId) {
  return `/translation/detect-language/${mailingId}`;
}

export function mailingDuplicateTranslate(mailingId) {
  return `/mailings/${mailingId}/duplicate-translate`;
}

export function translationJobStatus(jobId) {
  return `/translation/jobs/${jobId}/status`;
}

export function translationJobCancel(jobId) {
  return `/translation/jobs/${jobId}/cancel`;
}
