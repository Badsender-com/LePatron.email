'use strict';

// The app is white-labelled: the screens the MCP and skills stack adds name
// the platform company, never a brand. Each namespace below is one the stack
// added; the strings that came before it are not this test's.

const fr = require('../../../packages/ui/helpers/locales/fr.js').default;
const en = require('../../../packages/ui/helpers/locales/en.js').default;

const NAMESPACES = [
  'retex',
  'aiSkills.feedback',
  'oauthConsent',
  'mcpClients',
  'mcpAccess',
  'connectedApplications',
  'skillsImport',
  'aiSkills.export',
];

const at = (messages, path) =>
  path.split('.').reduce((node, key) => node && node[key], messages);
const stringsOf = (node) =>
  typeof node === 'string'
    ? [node]
    : Object.values(node || {}).flatMap(stringsOf);

describe.each([
  ['fr', fr],
  ['en', en],
])('the %s screens of the MCP and the skills', (_lang, messages) => {
  it.each(NAMESPACES)('name no brand in %s', (path) => {
    const strings = stringsOf(at(messages, path));

    expect(strings.length).toBeGreaterThan(0);
    strings.forEach((text) => expect(text).not.toMatch(/badsender/i));
  });
});
