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

// A company's name is any name: the French texts name it after « l'entreprise »,
// which reads right before a vowel as before a consonant.
describe('a company named in the French MCP texts', () => {
  const NAME = 'Entreprise test';
  const sections = [
    fr.groups.modules.mcp,
    fr.mcpAccess,
    fr.connectedApplications,
    fr.oauthConsent,
  ];
  const forms = sections
    .flatMap((section) => stringsOf(section))
    .filter((text) => text.includes('{group}'))
    .flatMap((text) => text.split(' | '))
    .map((form) => form.replace(/\{group\}/g, NAME))
    .filter((form) => form.includes(NAME));

  it('is found', () => {
    expect(forms.length).toBeGreaterThan(5);
  });

  it.each(forms)('reads right in « %s »', (form) => {
    expect(form).not.toMatch(
      new RegExp(`\\b(de|à|le|la|du|des|pour|dans|au) ${NAME}`)
    );
  });

  it('says the single connection the closing ends', () => {
    const [, one] = fr.groups.modules.mcp.closeConfirm.split(' | ');

    expect(one).toMatch(/^La seule connexion de l'entreprise \{group\}/);
  });
});

// Through the MCP, a skill is served as a prompt and the assistant's own model
// runs it: the Skills engine only runs the skills inside the app.
describe.each([
  ['fr', fr, /Playground/, /assistant connecté utilise son propre modèle/],
  ['en', en, /Playground/, /connected assistant uses its own model/],
])('the Skills engine in %s', (_lang, messages, inApp, ownModel) => {
  it('runs the skills inside the app, not a connected assistant', () => {
    const { description } = messages.aiFeatures.skill;

    expect(description).toMatch(inApp);
    expect(description).toMatch(ownModel);
  });
});
