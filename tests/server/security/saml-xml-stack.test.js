'use strict';

const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');

// SAML SSO parses the XML an identity provider posts (the SAMLResponse) in
// @node-saml/node-saml, in xml-crypto to check its signature, and in
// xml-encryption for an encrypted assertion. All three read it through the
// maintained @xmldom/xmldom, at the versions @node-saml/node-saml is tested
// with: these pin that stack, so a resolution or a downgrade that moves it
// fails here rather than at a customer's login.

// What a dependency's own package.json declares.
const manifestOf = (name) => require(`${name}/package.json`);

// The version of `name` a dependency actually gets when it requires it.
const resolvedFrom = (dependency, name) =>
  require(require.resolve(`${name}/package.json`, {
    paths: [path.dirname(require.resolve(`${dependency}/package.json`))],
  })).version;

const atLeast = (version, minimum) => {
  const [a, b, c] = version.split('.').map(Number);
  const [x, y, z] = minimum.split('.').map(Number);
  return a !== x ? a > x : b !== y ? b > y : c >= z;
};

const STACK = ['@node-saml/node-saml', 'xml-crypto', 'xml-encryption'];

describe('the SAML XML stack', () => {
  it.each(STACK)('%s parses with @xmldom/xmldom 0.8.15 or later', (name) => {
    const { dependencies = {} } = manifestOf(name);
    expect(dependencies).not.toHaveProperty('xmldom');
    expect(atLeast(resolvedFrom(name, '@xmldom/xmldom'), '0.8.15')).toBe(true);
  });

  it('checks signatures with xml-crypto 6.4.0 or later', () => {
    expect(
      atLeast(resolvedFrom('@node-saml/node-saml', 'xml-crypto'), '6.4.0')
    ).toBe(true);
  });

  it('refuses to build a document with multiple root elements', () => {
    const reported = [];
    const doc = new DOMParser({
      // xmldom only passes the level when the handler declares two
      // parameters (see buildErrorHandler in lib/dom-parser.js) — dropping
      // the second one silently turns `level` into the message.
      errorHandler: (level, message) => reported.push({ level, message }),
    }).parseFromString('<a/><b/>', 'text/xml');

    const roots = Array.from(doc.childNodes).filter(
      (node) => node.nodeType === 1
    );

    expect(roots).toHaveLength(1);
    expect(doc.documentElement.nodeName).toBe('a');
    expect(reported).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('Hierarchy request error'),
      })
    );
  });
});
