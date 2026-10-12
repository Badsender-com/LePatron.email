'use strict';

const { X509Certificate } = require('crypto');
const { BadRequest } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');

// SAML configuration of a company: where its identity provider lives
// (`entryPoint`), who we are to it (`issuer`), and the certificate it signs its
// responses with (`idpCert`).
//
// The certificate is required: passport-saml 2.x verifies a response's
// signature only when it is given a `cert`. A company without one has no usable
// SSO — the login page does not offer it and the strategy gets no options —
// rather than an SSO whose responses are not verified.

/**
 * The PEM form of a certificate pasted by a super admin, or '' to clear it.
 *
 * Accepts a full PEM block or the bare base64 body, as identity providers show
 * it both ways in their metadata. Refused when it does not parse as an X.509
 * certificate: a typo here would otherwise only surface as every SSO login
 * failing.
 *
 * @param {*} value
 * @returns {string}
 * @throws {BadRequest} INVALID_IDP_CERT
 */
function normalizeIdpCert(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new BadRequest(ERROR_CODES.INVALID_IDP_CERT);
  }

  const trimmed = value.trim();
  if (trimmed === '') return '';

  const pem = trimmed.includes('BEGIN CERTIFICATE')
    ? trimmed
    : `-----BEGIN CERTIFICATE-----\n${trimmed.replace(
        /\s+/g,
        ''
      )}\n-----END CERTIFICATE-----`;

  try {
    return new X509Certificate(pem).toString().trim();
  } catch (error) {
    throw new BadRequest(ERROR_CODES.INVALID_IDP_CERT);
  }
}

const isFilled = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * Whether a company's SSO can be used: an identity provider, an issuer, and the
 * certificate its responses are checked against.
 *
 * @param {Object} [group]
 * @returns {boolean}
 */
function isSamlConfigured(group) {
  return Boolean(
    group &&
      isFilled(group.entryPoint) &&
      isFilled(group.issuer) &&
      isFilled(group.idpCert)
  );
}

/**
 * The passport-saml options for a company, or null when its SSO is not fully
 * configured — never options without a certificate.
 *
 * @param {Object} [group]
 * @returns {{ entryPoint: string, issuer: string, cert: string }|null}
 */
function samlOptionsFor(group) {
  if (!isSamlConfigured(group)) return null;
  return {
    entryPoint: group.entryPoint,
    issuer: group.issuer,
    cert: group.idpCert,
  };
}

module.exports = { normalizeIdpCert, isSamlConfigured, samlOptionsFor };
