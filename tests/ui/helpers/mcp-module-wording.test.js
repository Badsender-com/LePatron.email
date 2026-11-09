'use strict';

// A company without the MCP module is said one way everywhere (ADR 0017): the
// module is not included, as the AI features say it. Nothing says its
// connections were ended at its closing: the company may never have had it.

const fr = require('../../../packages/ui/helpers/locales/fr.js').default;
const en = require('../../../packages/ui/helpers/locales/en.js').default;

const stringsOf = (node) =>
  typeof node === 'string'
    ? [node]
    : Object.values(node || {}).flatMap((child) => stringsOf(child));

describe.each([
  ['fr', fr, /module MCP n'est pas/, /module MCP n'est pas inclus/, /coupées/],
  ['en', en, /MCP module is not/, /MCP module is not included/, /ended/],
])('a missing MCP module in %s', (_lang, messages, missing, verb, ended) => {
  it('is always not included', () => {
    const sentences = stringsOf(messages).filter((text) => missing.test(text));

    expect(sentences.length).toBeGreaterThan(0);
    sentences.forEach((text) => expect(text).toMatch(verb));
  });

  it('says no connection ended on the connected applications page', () => {
    expect(messages.connectedApplications.noModule).not.toMatch(ended);
    expect(messages.connectedApplications.accessOff).toMatch(ended);
  });
});
