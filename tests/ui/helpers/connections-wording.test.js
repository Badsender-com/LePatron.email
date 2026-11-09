'use strict';

// The connections of an assistant (see "Connection" in GLOSSARY.md), named
// with one word in every message that counts or revokes them.

const fr = require('../../../packages/ui/helpers/locales/fr.js').default;
const en = require('../../../packages/ui/helpers/locales/en.js').default;

// What the company's tech admin revokes at once are its connections (see
// "Connection" in GLOSSARY.md): one word for them, in every message of it.
describe.each([
  [
    'fr',
    fr,
    /connexion/i,
    /applications? connectées?|assistants IA connectés/i,
  ],
  ['en', en, /connection/i, /connected applications?|assistants? connected/i],
])(
  'the revocation of every connection in %s',
  (_lang, messages, term, other) => {
    it.each([
      'groupCount',
      'groupRevokeTitle',
      'groupRevokeConfirm',
      'groupCountError',
      'groupRevoked',
    ])('says connections in %s', (key) => {
      const text = messages.connectedApplications[key];

      text.split(' | ').forEach((form) => {
        expect(form).toMatch(term);
        expect(form).not.toMatch(other);
      });
    });
  }
);

// Closing the MCP module ends connections, which its question counts.
it.each([
  ['fr', fr.groups.modules.mcp, /connexion/i],
  ['en', en.groups.modules.mcp, /connection/i],
])('the closing of the MCP module says connections in %s', (_l, mcp, term) => {
  const forms = `${mcp.closeConfirm} | ${mcp.closeConfirmUnknown}`;
  forms
    .split(' | ')
    .filter(Boolean)
    .forEach((form) => {
      expect(form).toMatch(term);
      expect(form).not.toMatch(/application/i);
    });
});
