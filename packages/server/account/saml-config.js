'use strict';

const { X509Certificate } = require('crypto');
const { BadRequest } = require('http-errors');

const config = require('../node.config.js');
const ERROR_CODES = require('../constant/error-codes.js');

// SAML configuration of a company: where its identity provider lives
// (`entryPoint`), who we are to it (`issuer`), and the certificate it signs its
// responses with (`idpCert`).
//
// The certificate is required: a company without one has no usable SSO — the
// login page does not offer it and the strategy gets no options — rather than
// an SSO whose responses are not verified.

// Where the identity provider posts its response (index.js mounts it).
const SAML_CALLBACK_PATH = '/SAML-login/callback';

// The scheme the site is served with: https everywhere but in development, as
// the FORCE HTTPS middleware of index.js decides.
const callbackUrl = () =>
  `http${config.isDev ? '' : 's'}://${config.host}${SAML_CALLBACK_PATH}`;

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
 * The SAML options for a company, or null when its SSO is not fully configured
 * — never options without a certificate.
 *
 * The response, or its assertion, must be signed with the company's
 * certificate: identity providers sign one or the other, or both, and each of
 * them keeps signing a company in. The assertion must name the company's
 * `issuer` as its audience.
 *
 * InResponseTo is not tied to a request we issued: the library remembers its
 * requests in the memory of one process, and the response may reach another
 * worker or instance; a sign-in started on the identity provider has none.
 *
 * @param {Object} [group]
 * @returns {Object|null}
 */
function samlOptionsFor(group) {
  if (!isSamlConfigured(group)) return null;
  return {
    entryPoint: group.entryPoint,
    issuer: group.issuer,
    idpCert: group.idpCert,
    audience: group.issuer,
    callbackUrl: callbackUrl(),
    wantAuthnResponseSigned: false,
    wantAssertionsSigned: false,
    validateInResponseTo: 'never',
    rejectReplayedAssertions: false,
  };
}

module.exports = {
  normalizeIdpCert,
  isSamlConfigured,
  samlOptionsFor,
  SAML_CALLBACK_PATH,
};
