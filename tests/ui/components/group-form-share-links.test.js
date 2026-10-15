'use strict';

// Turning preview links off suspends the links a company already shared: the
// group form asks first, and says that they come back with the switch.
//
// The project has no @vue/test-utils, so this reads the component source.

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '../../../packages/ui/components/group/form.vue'),
  'utf8'
);
const locales = {
  en: require('../../../packages/ui/helpers/locales/en.js'),
  fr: require('../../../packages/ui/helpers/locales/fr.js'),
};

describe('group form, preview links switch', () => {
  const switchTag = /<v-switch[^>]*shareLinksSwitchKey[\s\S]*?\/>/.exec(
    source
  )[0];

  it('asks before turning the links off, instead of binding the model', () => {
    expect(switchTag).toMatch(/@change="onShareLinksChange"/);
    expect(switchTag).not.toMatch(/v-model/);
    expect(source).toMatch(/ref="shareLinksOffDialog"/);
    expect(source).toMatch(/@confirm="confirmShareLinksOff"/);
  });

  it('puts the switch back when the confirmation is dismissed', () => {
    expect(source).toMatch(/@close="cancelShareLinksOff"/);
    expect(source).toMatch(/@click-outside="cancelShareLinksOff"/);
  });

  it.each(['en', 'fr'])('words the confirmation in %s', (lang) => {
    const strings = (locales[lang].default || locales[lang]).groups.modules
      .shareLinks;
    expect(strings.confirmOffTitle).toBeTruthy();
    expect(strings.confirmOffAction).toBeTruthy();
    expect(strings.confirmOffMessage).toBeTruthy();
  });
});
