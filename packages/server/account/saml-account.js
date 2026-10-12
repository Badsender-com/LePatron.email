'use strict';

const { XMLParser } = require('fast-xml-parser');

const { Users, Groups } = require('../common/models.common.js');
const { normalizeString } = require('../utils/model.js');
const { samlOptionsFor } = require('./saml-config.js');

// SSO signs a person in through the identity provider of their own company,
// and only that one. A response is checked against the certificate of the
// company of the account it names, and the account it signs in must belong to
// the company whose certificate checked it.

const companyIdOf = (user) => String(user._company?._id || user._company);

/**
 * The NameID of a SAML response, read before its signature is checked: it
 * only picks the certificate to check the response with. Whatever the
 * namespace prefixes, with or without a Format attribute; anything else, a
 * response carrying several assertions included, gives undefined.
 *
 * @param {string} samlResponse the base64 response the IdP posted
 * @returns {string|undefined}
 */
function nameIdOf(samlResponse) {
  try {
    const xml = Buffer.from(String(samlResponse), 'base64').toString();
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      trimValues: true,
    });
    const nameId = parser.parse(xml)?.Response?.Assertion?.Subject?.NameID;
    return typeof nameId === 'object' && nameId !== null
      ? nameId['#text']
      : nameId;
  } catch (error) {
    return undefined;
  }
}

function findAccount(email) {
  if (typeof email !== 'string' || email.trim() === '') return null;
  return Users.findOne({
    email: normalizeString(email),
    isDeactivated: { $ne: true },
    token: { $exists: false },
  });
}

/**
 * The passport-saml options for a request. Starting a sign-in, the login page
 * names the account in the query string; on the callback, the account comes
 * from the response itself, never from the query string, which the sender of
 * the response chooses. Remembers on the request which company's certificate
 * the response is checked against.
 *
 * @param {Object} request
 * @returns {Promise<Object>} the options
 * @throws {Error} when no account or no usable SSO matches
 */
async function samlOptionsForRequest(request) {
  const samlResponse = request.body && request.body.SAMLResponse;
  const email = samlResponse
    ? nameIdOf(samlResponse)
    : request.query && request.query.email;

  const user = await findAccount(email);
  if (!user) throw new Error('SAML provider not found');

  const group = await Groups.findOne({ _id: companyIdOf(user) });
  // Never options without the identity provider's certificate: passport-saml
  // verifies a response's signature only when it has one.
  const samlOptions = samlOptionsFor(group);
  if (!samlOptions) throw new Error('Provider informations not found');

  request.samlCompanyId = String(group._id);
  return samlOptions;
}

/**
 * The account a checked response signs in: the one its NameID names, if it
 * belongs to the company whose certificate checked the response.
 *
 * @param {Object} req the request `samlOptionsForRequest` read
 * @param {Object} profile the profile passport-saml read from the response
 * @returns {Promise<Object|null>}
 */
async function accountOfResponse(req, profile) {
  const user = await findAccount(profile && profile.nameID);
  if (!user || !req.samlCompanyId) return null;
  if (companyIdOf(user) !== req.samlCompanyId) return null;
  return user;
}

module.exports = { nameIdOf, samlOptionsForRequest, accountOfResponse };
