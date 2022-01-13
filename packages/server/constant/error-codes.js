'use strict';

module.exports = {
  WORKSPACE_ALREADY_EXISTS: 'WORKSPACE_ALREADY_EXISTS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN_WORKSPACE_CREATION: 'FORBIDDEN_WORKSPACE_CREATION',
  FORBIDDEN_WORKSPACE_RETRIEVAL: 'FORBIDDEN_WORKSPACE_RETRIEVAL',
  FORBIDDEN_PROFILE_ACCESS: 'FORBIDDEN_PROFILE_ACCESS',
  WORKSPACE_ID_NOT_PROVIDED: 'WORKSPACE_ID_NOT_PROVIDED',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  TOO_MUCH_RECURRENT_LOOP: 'TOO_MUCH_RECURRENT_LOOP',
  GROUP_NOT_FOUND: 'GROUP_NOT_FOUND',
  EMAIL_GROUP_NOT_FOUND: 'EMAIL_GROUP_NOT_FOUND',
  EMAIL_GROUP_NAME_ALREADY_EXIST: 'EMAIL_GROUP_NAME_ALREADY_EXIST',
  FAILED_EMAIL_GROUP_DELETE: 'FAILED_EMAIL_GROUP_DELETE',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  FORBIDDEN_MAILING_RENAME: 'FORBIDDEN_MAILING_RENAME',
  FORBIDDEN_MAILING_DELETE: 'FORBIDDEN_MAILING_DELETE',
  FORBIDDEN_MAILING_COPY: 'FORBIDDEN_MAILING_COPY',
  FAILED_MAILING_RENAME: 'FAILED_MAILING_RENAME',
  MISSING_GROUP_PARAM: 'MISSING_GROUP_PARAM',
  FAILED_FOLDER_RENAME: 'FAILED_FOLDER_RENAME',
  FAILED_MAILING_DELETE: 'FAILED_MAILING_DELETE',
  MISSING_EMAIL_GROUP_NAME_PARAM: 'MISSING_EMAIL_GROUP_NAME_PARAM',
  MISSING_EMAIL_GROUP_EMAILS_PARAM: 'MISSING_EMAIL_GROUP_EMAILS_PARAM',
  MAILING_MISSING_SOURCE: 'MAILING_MISSING_SOURCE',
  MAILING_HTML_MISSING: 'MAILING_HTML_MISSING',
  FAILED_MAILING_COPY: 'FAILED_MAILING_COPY',
  FAILED_MAILING_MOVE: 'FAILED_MAILING_MOVE',
  NAME_NOT_PROVIDED: 'NAME_NOT_PROVIDED',
  TEMPLATE_NOT_PROVIDED: 'TEMPLATE_NOT_PROVIDED',
  PARENT_NOT_PROVIDED: 'PARENT_NOT_PROVIDED',
  TWO_PARENTS_PROVIDED: 'TWO_PARENTS_PROVIDED',
  FORBIDDEN_FOLDER_CREATION: 'FORBIDDEN_FOLDER_CREATION',
  FOLDER_NOT_FOUND: 'FOLDER_NOT_FOUND',
  MAILING_NOT_FOUND: 'MAILING_NOT_FOUND',
  ARCHIVE_IS_NULL: 'ARCHIVE_IS_NULL',
  HTML_IS_NULL: 'HTML_IS_NULL',
  NAME_ALREADY_TAKEN_AT_SAME_LEVEL: 'NAME_ALREADY_TAKEN_AT_SAME_LEVEL',
  PARENT_FOLDER_IS_SUBFOLDER: 'PARENT_FOLDER_IS_SUBFOLDER',
  FORBIDDEN_RESOURCE_OR_ACTION: 'FORBIDDEN_RESOURCE_OR_ACTION',
  FAILED_FOLDER_DELETE: 'FAILED_FOLDER_DELETE',
  FAILED_FOLDER_UPDATE: 'FAILED_FOLDER_UPDATE',
  FAILED_FOLDER_MOVE: 'FAILED_FOLDER_MOVE',
  FOLDER_HAS_CHILDREN: 'FOLDER_HAS_CHILDREN',
  FAILED_WORKSPACE_CREATION: 'FAILED_WORKSPACE_CREATION',
  FAILED_USERS_UPDATE: 'FAILED_USERS_UPDATE',
  FOLDER_MISSING_NAME: 'FOLDER_MISSING_NAME',
  MAILING_HAS_TWO_SOURCES: 'MAILING_HAS_TWO_SOURCES',
  EMAIL_NOT_VALID: 'EMAIL_NOT_VALID',
  FTP_NOT_DEFINED_FOR_GROUP: 'FTP_NOT_DEFINED_FOR_GROUP',
  CONFLICT_CDN_AND_REGULAR_DOWNLOAD_VALUES:
    'CONFLICT_CDN_AND_REGULAR_DOWNLOAD_VALUES',
  MAIL_ALREADY_SENT_TO_PROFILE: 'MAIL_ALREADY_SENT_TO_PROFILE',

  // PROFILE
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  PROFILE_NAME_ALREADY_EXIST: 'PROFILE_NAME_ALREADY_EXIST',
  FAILED_PROFILE_DELETE: 'FAILED_PROFILE_DELETE',
  INCOHERENT_PROFILE_TYPES: 'INCOHERENT_PROFILE_TYPES',
  UNAUTHORIZED_ESP: 'UNAUTHORIZED_ESP',
  UNAUTHORIZED_METHOD_CALL_ON_SENDINBLUE_PROVIDER:
    'UNAUTHORIZED_METHOD_CALL_ON_SENDINBLUE_PROVIDER',
  UNAUTHORIZED_METHOD_CALL_ON_ACTITO_PROVIDER:
    'UNAUTHORIZED_METHOD_CALL_ON_ACTITO_PROVIDER',
  MALFORMAT_ESP_RESPONSE: 'MALFORMAT_ESP_RESPONSE',
  API_CALL_IS_NOT_A_FUNCTION: 'API_CALL_IS_NOT_A_FUNCTION',
  CAMPAIGN_ID_MUST_BE_DEFINED: 'CAMPAIGN_ID_MUST_BE_DEFINED',
  MISSING_DOWNLOAD_OPTIONS: 'MISSING_DOWNLOAD_OPTIONS',
  MISSING_PROPERTIES_ESP_ID: 'MISSING_PROPERTIES_ESP_ID',
  MISSING_PROPERTIES_CAMPAIGN_MAIL_ID: 'MISSING_PROPERTIES_CAMPAIGN_MAIL_ID',
  MISSING_PROPERTIES_ENTITY: 'MISSING_PROPERTIES_ENTITY',
  UNDEFINED_ACTITO_BASE_API_URL: 'UNDEFINED_ACTITO_BASE_API_URL',
  MISSING_PROPERTIES_TEMPLATE_ID: 'MISSING_PROPERTIES_TEMPLATE_ID',
  UNEXPECTED_ERROR_WHILE_PROCESSING_HTML:
    'UNEXPECTED_ERROR_WHILE_PROCESSING_HTML',
  UNEXPECTED_ESP_RESPONSE: 'UNEXPECTED_ESP_RESPONSE',
  UNEXPECTED_ERROR_WHILE_PROCESSING_PROXY:
    'UNEXPECTED_ERROR_WHILE_PROCESSING_PROXY',
  ALREADY_USED_MAIL_NAME: 'ALREADY_USED_MAIL_NAME',
  IP_ADDRESS_IS_NOT_ALLOWED: 'IP_ADDRESS_IS_NOT_ALLOWED',
  UNEXPECTED_ERROR_WHILE_ARCHIVING_PROCESSED_HTML:
    'UNEXPECTED_ERROR_WHILE_ARCHIVING_PROCESSED_HTML',
  ESP_PROVIDER_INSTANCE_NOT_DEFINED: 'ESP_PROVIDER_INSTANCE_NOT_DEFINED',
};
