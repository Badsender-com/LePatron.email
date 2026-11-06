'use strict';

// The retex switch of a company (ADR 0012): under it, the admin reads that the
// rating and the comment of a feedback reach the platform company whether the
// retex is allowed or not; only the session summary depends on it.
//
// The project has no @vue/test-utils, so this reads the component source.

const fs = require('fs');
const path = require('path');
const fr = require('../../../packages/ui/helpers/locales/fr.js').default;
const en = require('../../../packages/ui/helpers/locales/en.js').default;

const source = fs.readFileSync(
  path.join(
    __dirname,
    '../../../packages/ui/components/group/retex-option.vue'
  ),
  'utf8'
);

describe('the retex option of a company', () => {
  it('says under the switch what is always shared', () => {
    const switchAt = source.indexOf('<v-switch');
    const noteAt = source.indexOf("$t('retex.alwaysShared')");

    expect(switchAt).toBeGreaterThan(-1);
    expect(noteAt).toBeGreaterThan(switchAt);
  });

  it.each([
    ['fr', fr, /note et le commentaire.*entreprise plateforme/],
    ['en', en, /rating and the comment.*platform company/],
  ])('says it in %s', (_lang, messages, said) => {
    expect(messages.retex.alwaysShared).toMatch(said);
  });

  // Turning the retex off forgets what it let the feedbacks keep (ADR 0012).
  it.each([
    ['fr', fr, /efface les résumés.*500 caractères/],
    ['en', en, /erases the session summaries.*500 characters/],
  ])('says in %s what turning it off erases', (_lang, messages, said) => {
    expect(source).toMatch(/\$t\('retex\.offForgets'\)/);
    expect(messages.retex.offForgets).toMatch(said);
  });
});
