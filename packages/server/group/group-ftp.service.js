'use strict';

const { BadRequest } = require('http-errors');
const FTPClient = require('../mailing/ftp-client.service.js');
const ERROR_CODES = require('../constant/error-codes.js');

// Constants for credential masking
const CREDENTIAL_MASK = '••••••••';
const DELETE_CREDENTIAL = '__DELETE__';

/**
 * Validate SSH key format (PEM or OpenSSH)
 * @param {string} sshKey - The SSH key to validate
 * @returns {{valid: boolean, message?: string}}
 */
function validateSshKeyFormat(sshKey) {
  if (!sshKey || sshKey === CREDENTIAL_MASK) return { valid: true };

  const trimmed = sshKey.trim();
  const isPEM =
    trimmed.startsWith('-----BEGIN RSA PRIVATE KEY-----') ||
    trimmed.startsWith('-----BEGIN DSA PRIVATE KEY-----') ||
    trimmed.startsWith('-----BEGIN EC PRIVATE KEY-----');
  const isOpenSSH = trimmed.startsWith('-----BEGIN OPENSSH PRIVATE KEY-----');

  if (!isPEM && !isOpenSSH) {
    return {
      valid: false,
      errorCode: ERROR_CODES.INVALID_SSH_KEY_FORMAT,
      message: 'Invalid SSH key format. Accepted formats: PEM or OpenSSH.',
    };
  }

  if (!trimmed.includes('-----END')) {
    return {
      valid: false,
      errorCode: ERROR_CODES.INCOMPLETE_SSH_KEY,
      message: 'Incomplete SSH key: missing end marker.',
    };
  }

  return { valid: true };
}

/**
 * Validate SSH key and throw BadRequest if invalid
 * @param {string} sshKey - The SSH key to validate
 * @throws {BadRequest} If the SSH key is invalid
 */
function validateSshKeyOrThrow(sshKey) {
  const validation = validateSshKeyFormat(sshKey);
  if (!validation.valid) {
    throw new BadRequest(validation.errorCode);
  }
}

/**
 * Mask FTP credentials in group object for API response
 * @param {Object} group - The group object (Mongoose document or plain object)
 * @returns {Object} Group object with masked credentials
 */
function maskFtpCredentials(group) {
  // Use toJSON to include virtuals (like 'id') as configured in schema
  const groupObj = group.toJSON ? group.toJSON() : { ...group };
  if (groupObj.ftpPassword) {
    groupObj.ftpPassword = CREDENTIAL_MASK;
  }
  if (groupObj.ftpSshKey) {
    groupObj.ftpSshKey = CREDENTIAL_MASK;
  }
  return groupObj;
}

/**
 * Process credentials before update (handle masking and deletion)
 * @param {Object} body - The request body
 * @returns {Object} Processed body with credentials handled
 */
function processCredentialsForUpdate(body) {
  const processed = { ...body };

  if (processed.ftpAuthType === 'ssh_key') {
    // Inactive credential: always clear
    processed.ftpPassword = '';
    // Active credential: respect mask (preserve) or accept new value
    if (processed.ftpSshKey === CREDENTIAL_MASK) {
      delete processed.ftpSshKey;
    } else if (processed.ftpSshKey === DELETE_CREDENTIAL) {
      processed.ftpSshKey = '';
    }
  } else if (processed.ftpAuthType === 'password') {
    // Inactive credential: always clear
    processed.ftpSshKey = '';
    // Active credential: respect mask (preserve) or accept new value
    if (processed.ftpPassword === CREDENTIAL_MASK) {
      delete processed.ftpPassword;
    } else if (processed.ftpPassword === DELETE_CREDENTIAL) {
      processed.ftpPassword = '';
    }
  } else {
    // No auth type change: process both credentials independently
    if (processed.ftpPassword === CREDENTIAL_MASK) {
      delete processed.ftpPassword;
    } else if (processed.ftpPassword === DELETE_CREDENTIAL) {
      processed.ftpPassword = '';
    }
    if (processed.ftpSshKey === CREDENTIAL_MASK) {
      delete processed.ftpSshKey;
    } else if (processed.ftpSshKey === DELETE_CREDENTIAL) {
      processed.ftpSshKey = '';
    }
  }

  return processed;
}

/**
 * Test FTP connection for a group
 * @param {Object} group - The group document with FTP settings
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function testConnection(group) {
  if (!group.downloadMailingWithFtpImages) {
    return {
      success: false,
      errorCode: ERROR_CODES.FTP_NOT_ENABLED,
      message: 'FTP is not enabled for this group',
    };
  }

  if (group.ftpAuthType === 'ssh_key') {
    if (!group.ftpSshKey) {
      return {
        success: false,
        errorCode: ERROR_CODES.FTP_MISSING_SSH_KEY,
        message: 'No SSH key configured for this group.',
      };
    }
    const keyValidation = validateSshKeyFormat(group.ftpSshKey);
    if (!keyValidation.valid) {
      return {
        success: false,
        errorCode: keyValidation.errorCode,
        message: keyValidation.message,
      };
    }
  }

  try {
    const ftpClient = new FTPClient(
      group.ftpHost,
      group.ftpPort,
      group.ftpUsername,
      group.ftpPassword,
      group.ftpProtocol,
      { authType: group.ftpAuthType, sshKey: group.ftpSshKey }
    );

    await ftpClient.client.connect(ftpClient.settings);
    const exists = await ftpClient.client.exists(group.ftpPathOnServer || './');
    await ftpClient.client.end();

    if (exists) {
      return { success: true, message: 'Connection successful' };
    }
    return {
      success: false,
      errorCode: ERROR_CODES.FTP_PATH_NOT_FOUND,
      message: `Path "${group.ftpPathOnServer}" not found on server`,
    };
  } catch (error) {
    return mapFtpError(error, group);
  }
}

/**
 * Map FTP connection errors to user-friendly messages
 * @param {Error} error - The caught error
 * @param {Object} group - The group with FTP settings
 * @returns {{success: false, errorCode: string, message: string}}
 */
function mapFtpError(error, group) {
  const errorMessage = error.message || '';

  if (
    errorMessage.includes('authentication') ||
    errorMessage.includes('Authentication')
  ) {
    return {
      success: false,
      errorCode: ERROR_CODES.FTP_CONNECTION_AUTH_FAILED,
      message:
        'Authentication failed. Check your credentials (password or SSH key).',
    };
  }

  if (
    errorMessage.includes('getaddrinfo') ||
    errorMessage.includes('Address lookup failed')
  ) {
    return {
      success: false,
      errorCode: ERROR_CODES.FTP_CONNECTION_HOST_NOT_FOUND,
      message: `Host not found: ${group.ftpHost}`,
    };
  }

  if (
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('refused connection')
  ) {
    return {
      success: false,
      errorCode: ERROR_CODES.FTP_CONNECTION_REFUSED,
      message: `Connection refused on ${group.ftpHost}:${group.ftpPort}`,
    };
  }

  if (
    errorMessage.includes('privateKey') ||
    errorMessage.includes('signing data with key') ||
    errorMessage.includes('asn1')
  ) {
    return {
      success: false,
      errorCode: ERROR_CODES.FTP_CONNECTION_INVALID_KEY,
      message: 'Invalid SSH key or unsupported format.',
    };
  }

  if (errorMessage.includes('ETIMEDOUT')) {
    return {
      success: false,
      errorCode: ERROR_CODES.FTP_CONNECTION_TIMEOUT,
      message: `Connection timeout to ${group.ftpHost}:${group.ftpPort}`,
    };
  }

  if (
    errorMessage.includes('Handshake') ||
    errorMessage.includes('handshake') ||
    errorMessage.includes('HMAC')
  ) {
    return {
      success: false,
      errorCode: ERROR_CODES.FTP_CONNECTION_HANDSHAKE_FAILED,
      message:
        'SSH handshake failed. The server may use unsupported algorithms.',
    };
  }

  return {
    success: false,
    errorCode: ERROR_CODES.UNEXPECTED_SERVER_ERROR,
    message: errorMessage,
  };
}

module.exports = {
  CREDENTIAL_MASK,
  DELETE_CREDENTIAL,
  validateSshKeyFormat,
  validateSshKeyOrThrow,
  maskFtpCredentials,
  processCredentialsForUpdate,
  testConnection,
  mapFtpError,
};
