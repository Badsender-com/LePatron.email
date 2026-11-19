'use strict';

// A throwaway SAML identity provider for tests: a self-signed certificate, and
// responses signed with its key the way an IdP signs them, on the assertion or
// on the whole response.
//
// Generated at runtime rather than committed, so no private key lives in the
// repository. node-forge comes with selfsigned (the dev server's certificate),
// xml-crypto with @node-saml/node-saml.

const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');

const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const EXCLUSIVE_C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

// The service provider a test company is configured with: its `issuer` is the
// audience its identity provider writes in every assertion.
const SP_ENTITY_ID = 'lepatron';
const IDP_ENTITY_ID = 'https://idp.example.test';
const VALIDITY_MS = 5 * 60 * 1000;

const byName = (name) => `//*[local-name(.)='${name}']`;

function createIdp() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 24 * 3600 * 1000);
  cert.validity.notAfter = new Date(Date.now() + 24 * 3600 * 1000);
  const subject = [{ name: 'commonName', value: 'test-idp' }];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

  // `element` signed, its signature inserted before `before`, as the SAML
  // schema places it: right after the element's Issuer.
  function sign(xml, element, before) {
    const signer = new SignedXml({
      privateKey: privateKeyPem,
      signatureAlgorithm: RSA_SHA256,
      canonicalizationAlgorithm: EXCLUSIVE_C14N,
    });
    signer.addReference({
      xpath: byName(element),
      transforms: [ENVELOPED, EXCLUSIVE_C14N],
      digestAlgorithm: SHA256,
    });
    signer.computeSignature(xml, {
      location: { reference: byName(before), action: 'before' },
    });
    return signer.getSignedXml();
  }

  return {
    certPem: forge.pki.certificateToPem(cert),

    // A minimal successful response for `nameID`, unsigned. `audience` is the
    // service provider it is meant for; null leaves the restriction out.
    response(nameID, { audience = SP_ENTITY_ID } = {}) {
      const now = new Date();
      const notBefore = new Date(now.getTime() - VALIDITY_MS).toISOString();
      const notOnOrAfter = new Date(now.getTime() + VALIDITY_MS).toISOString();
      const restriction =
        audience === null
          ? ''
          : '<saml2:AudienceRestriction>' +
            `<saml2:Audience>${audience}</saml2:Audience>` +
            '</saml2:AudienceRestriction>';
      return (
        '<saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol"' +
        ' xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion"' +
        ` ID="_response" Version="2.0" IssueInstant="${now.toISOString()}">` +
        `<saml2:Issuer>${IDP_ENTITY_ID}</saml2:Issuer>` +
        '<saml2p:Status><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></saml2p:Status>' +
        `<saml2:Assertion ID="_assertion" Version="2.0" IssueInstant="${now.toISOString()}">` +
        `<saml2:Issuer>${IDP_ENTITY_ID}</saml2:Issuer>` +
        `<saml2:Subject><saml2:NameID>${nameID}</saml2:NameID></saml2:Subject>` +
        `<saml2:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">` +
        restriction +
        '</saml2:Conditions>' +
        '</saml2:Assertion></saml2p:Response>'
      );
    },

    // The same response, its assertion signed by this IdP.
    signedResponse(nameID, options) {
      return sign(this.response(nameID, options), 'Assertion', 'Subject');
    },

    // The same response, signed as a whole by this IdP, its assertion not.
    signedEnvelope(nameID, options) {
      return sign(this.response(nameID, options), 'Response', 'Status');
    },
  };
}

module.exports = { createIdp, SP_ENTITY_ID };
