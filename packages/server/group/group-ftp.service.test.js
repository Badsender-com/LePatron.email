'use strict';

const groupFtpService = require('./group-ftp.service');
const ERROR_CODES = require('../constant/error-codes');

describe('Group FTP Service', () => {
  describe('validateSshKeyFormat', () => {
    it('should return valid for empty or null SSH key', () => {
      expect(groupFtpService.validateSshKeyFormat('')).toEqual({ valid: true });
      expect(groupFtpService.validateSshKeyFormat(null)).toEqual({ valid: true });
      expect(groupFtpService.validateSshKeyFormat(undefined)).toEqual({ valid: true });
    });

    it('should return valid for masked credential', () => {
      const result = groupFtpService.validateSshKeyFormat(groupFtpService.CREDENTIAL_MASK);
      expect(result).toEqual({ valid: true });
    });

    it('should return valid for RSA PEM format', () => {
      const rsaKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MrXKc9CYvFbJ9U3Z
-----END RSA PRIVATE KEY-----`;
      const result = groupFtpService.validateSshKeyFormat(rsaKey);
      expect(result).toEqual({ valid: true });
    });

    it('should return valid for DSA PEM format', () => {
      const dsaKey = `-----BEGIN DSA PRIVATE KEY-----
MIIBuwIBAAKBgQD1234567890abcdef
-----END DSA PRIVATE KEY-----`;
      const result = groupFtpService.validateSshKeyFormat(dsaKey);
      expect(result).toEqual({ valid: true });
    });

    it('should return valid for EC PEM format', () => {
      const ecKey = `-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIKYr4567890abcdef
-----END EC PRIVATE KEY-----`;
      const result = groupFtpService.validateSshKeyFormat(ecKey);
      expect(result).toEqual({ valid: true });
    });

    it('should return valid for OpenSSH format', () => {
      const opensshKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtz
-----END OPENSSH PRIVATE KEY-----`;
      const result = groupFtpService.validateSshKeyFormat(opensshKey);
      expect(result).toEqual({ valid: true });
    });

    it('should return invalid for unrecognized format', () => {
      const invalidKey = 'some random text that is not a key';
      const result = groupFtpService.validateSshKeyFormat(invalidKey);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(ERROR_CODES.INVALID_SSH_KEY_FORMAT);
    });

    it('should return invalid for incomplete key (missing end marker)', () => {
      const incompleteKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MrXKc9CYvFbJ9U3Z`;
      const result = groupFtpService.validateSshKeyFormat(incompleteKey);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(ERROR_CODES.INCOMPLETE_SSH_KEY);
    });

    it('should handle keys with whitespace', () => {
      const keyWithWhitespace = `  -----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA
-----END RSA PRIVATE KEY-----  `;
      const result = groupFtpService.validateSshKeyFormat(keyWithWhitespace);
      expect(result).toEqual({ valid: true });
    });
  });

  describe('validateSshKeyOrThrow', () => {
    it('should not throw for valid SSH key', () => {
      const validKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA
-----END RSA PRIVATE KEY-----`;
      expect(() => groupFtpService.validateSshKeyOrThrow(validKey)).not.toThrow();
    });

    it('should throw BadRequest for invalid SSH key', () => {
      const invalidKey = 'invalid key';
      expect(() => groupFtpService.validateSshKeyOrThrow(invalidKey)).toThrow();
    });
  });

  describe('maskFtpCredentials', () => {
    it('should mask ftpPassword when present', () => {
      const group = {
        toJSON: () => ({
          id: '123',
          name: 'Test Group',
          ftpPassword: 'secret123',
          ftpHost: 'localhost',
        }),
      };
      const result = groupFtpService.maskFtpCredentials(group);
      expect(result.ftpPassword).toBe(groupFtpService.CREDENTIAL_MASK);
      expect(result.ftpHost).toBe('localhost');
      expect(result.id).toBe('123');
    });

    it('should mask ftpSshKey when present', () => {
      const group = {
        toJSON: () => ({
          id: '123',
          name: 'Test Group',
          ftpSshKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----',
          ftpHost: 'localhost',
        }),
      };
      const result = groupFtpService.maskFtpCredentials(group);
      expect(result.ftpSshKey).toBe(groupFtpService.CREDENTIAL_MASK);
    });

    it('should mask both password and SSH key when present', () => {
      const group = {
        toJSON: () => ({
          ftpPassword: 'secret',
          ftpSshKey: 'key-content',
        }),
      };
      const result = groupFtpService.maskFtpCredentials(group);
      expect(result.ftpPassword).toBe(groupFtpService.CREDENTIAL_MASK);
      expect(result.ftpSshKey).toBe(groupFtpService.CREDENTIAL_MASK);
    });

    it('should not add mask fields if credentials are not present', () => {
      const group = {
        toJSON: () => ({
          id: '123',
          name: 'Test Group',
          ftpHost: 'localhost',
        }),
      };
      const result = groupFtpService.maskFtpCredentials(group);
      expect(result.ftpPassword).toBeUndefined();
      expect(result.ftpSshKey).toBeUndefined();
    });

    it('should handle plain objects without toJSON', () => {
      const group = {
        id: '123',
        ftpPassword: 'secret',
      };
      const result = groupFtpService.maskFtpCredentials(group);
      expect(result.ftpPassword).toBe(groupFtpService.CREDENTIAL_MASK);
      expect(result.id).toBe('123');
    });
  });

  describe('processCredentialsForUpdate', () => {
    it('should preserve existing password when mask is sent', () => {
      const body = {
        name: 'Updated Name',
        ftpPassword: groupFtpService.CREDENTIAL_MASK,
        ftpHost: 'newhost.com',
      };
      const result = groupFtpService.processCredentialsForUpdate(body);
      expect(result.ftpPassword).toBeUndefined();
      expect(result.name).toBe('Updated Name');
      expect(result.ftpHost).toBe('newhost.com');
    });

    it('should preserve existing SSH key when mask is sent', () => {
      const body = {
        ftpSshKey: groupFtpService.CREDENTIAL_MASK,
      };
      const result = groupFtpService.processCredentialsForUpdate(body);
      expect(result.ftpSshKey).toBeUndefined();
    });

    it('should clear password when DELETE_CREDENTIAL is sent', () => {
      const body = {
        ftpPassword: groupFtpService.DELETE_CREDENTIAL,
      };
      const result = groupFtpService.processCredentialsForUpdate(body);
      expect(result.ftpPassword).toBe('');
    });

    it('should clear SSH key when DELETE_CREDENTIAL is sent', () => {
      const body = {
        ftpSshKey: groupFtpService.DELETE_CREDENTIAL,
      };
      const result = groupFtpService.processCredentialsForUpdate(body);
      expect(result.ftpSshKey).toBe('');
    });

    it('should keep new password when different value is sent', () => {
      const body = {
        ftpPassword: 'newpassword123',
      };
      const result = groupFtpService.processCredentialsForUpdate(body);
      expect(result.ftpPassword).toBe('newpassword123');
    });

    it('should keep new SSH key when different value is sent', () => {
      const newKey = '-----BEGIN RSA PRIVATE KEY-----\nnewkey\n-----END RSA PRIVATE KEY-----';
      const body = {
        ftpSshKey: newKey,
      };
      const result = groupFtpService.processCredentialsForUpdate(body);
      expect(result.ftpSshKey).toBe(newKey);
    });

    it('should handle both credentials simultaneously', () => {
      const body = {
        ftpPassword: groupFtpService.CREDENTIAL_MASK,
        ftpSshKey: 'new-key-value',
      };
      const result = groupFtpService.processCredentialsForUpdate(body);
      expect(result.ftpPassword).toBeUndefined();
      expect(result.ftpSshKey).toBe('new-key-value');
    });
  });

  describe('mapFtpError', () => {
    const mockGroup = {
      ftpHost: 'example.com',
      ftpPort: 22,
    };

    it('should map authentication error', () => {
      const error = new Error('Authentication failed');
      const result = groupFtpService.mapFtpError(error, mockGroup);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ERROR_CODES.FTP_CONNECTION_AUTH_FAILED);
    });

    it('should map host not found error', () => {
      const error = new Error('getaddrinfo ENOTFOUND example.com');
      const result = groupFtpService.mapFtpError(error, mockGroup);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ERROR_CODES.FTP_CONNECTION_HOST_NOT_FOUND);
      expect(result.message).toContain('example.com');
    });

    it('should map connection refused error', () => {
      const error = new Error('connect ECONNREFUSED');
      const result = groupFtpService.mapFtpError(error, mockGroup);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ERROR_CODES.FTP_CONNECTION_REFUSED);
    });

    it('should map invalid private key error', () => {
      const error = new Error('Cannot parse privateKey');
      const result = groupFtpService.mapFtpError(error, mockGroup);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ERROR_CODES.FTP_CONNECTION_INVALID_KEY);
    });

    it('should map timeout error', () => {
      const error = new Error('connect ETIMEDOUT');
      const result = groupFtpService.mapFtpError(error, mockGroup);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ERROR_CODES.FTP_CONNECTION_TIMEOUT);
    });

    it('should return generic error for unknown errors', () => {
      const error = new Error('Some unknown error');
      const result = groupFtpService.mapFtpError(error, mockGroup);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ERROR_CODES.UNEXPECTED_SERVER_ERROR);
      expect(result.message).toBe('Some unknown error');
    });
  });
});
