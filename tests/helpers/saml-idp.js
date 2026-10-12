'use strict';

// A throwaway SAML identity provider for tests: a self-signed certificate, and
// responses signed with its key the way an IdP signs an assertion.
//
// Generated at runtime rather than committed, so no private key lives in the
// repository. node-forge comes with xml-encryption, a passport-saml dependency.

const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');

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

  return {
    certPem: forge.pki.certificateToPem(cert),

    // A minimal successful response for `nameID`, unsigned.
    response(nameID) {
      const now = new Date().toISOString();
      return (
        '<saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol"' +
        ' xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion"' +
        ` ID="_response" Version="2.0" IssueInstant="${now}">` +
        '<saml2p:Status><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></saml2p:Status>' +
        `<saml2:Assertion ID="_assertion" Version="2.0" IssueInstant="${now}">` +
        `<saml2:Subject><saml2:NameID>${nameID}</saml2:NameID></saml2:Subject>` +
        '</saml2:Assertion></saml2p:Response>'
      );
    },

    // The same response, its assertion signed by this IdP.
    signedResponse(nameID) {
      const signer = new SignedXml();
      signer.addReference("//*[local-name(.)='Assertion']", [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/2001/10/xml-exc-c14n#',
      ]);
      signer.signingKey = privateKeyPem;
      signer.computeSignature(this.response(nameID), {
        location: {
          reference: "//*[local-name(.)='Subject']",
          action: 'before',
        },
      });
      return signer.getSignedXml();
    },
  };
}

module.exports = { createIdp };
