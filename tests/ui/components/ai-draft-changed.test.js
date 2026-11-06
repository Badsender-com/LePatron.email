/**
 * @jest-environment jsdom
 */
'use strict';

// A draft written since the page read it, by an assistant or another person
// (ADR 0014): the page sends the update date it read with a save and with a
// publication; on the server's refusal it keeps what the person typed, says
// so with a way to reload, and reloading shows the draft as it is now.

const fs = require('fs');
const path = require('path');
const Vue = require('vue');
const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const mixinAiVersionedItem = require('../../../packages/ui/helpers/mixins/mixin-ai-versioned-item.js')
  .default;

const READ_AT = '2026-11-01T10:00:00.000Z';
const draft = (fields) => ({
  versionMajor: 1,
  versionMinor: 1,
  status: 'DRAFT',
  updatedAt: READ_AT,
  ...fields,
});
const refusal = {
  response: { status: 409, data: { message: 'SKILL_VERSION_CHANGED' } },
};

function page($get) {
  return new Vue({
    mixins: [
      mixinAiVersionedItem({
        key: 'exp',
        idField: 'expertiseId',
        routes: { item: (id) => `/ai-expertise/${id}` },
        archivedKey: 'archived',
      }),
    ],
    data: () => ({
      exp: { expertiseId: 'qc.rules', versions: [draft({ body: 'Read' })] },
      saving: false,
    }),
    beforeCreate() {
      // What mapMutations reads of the store's `page` module.
      const commit = jest.fn();
      this.$store = {
        commit,
        _modulesNamespaceMap: { 'page/': { context: { commit } } },
      };
      this.$t = (key) => key;
      this.$axios = { $get };
    },
  });
}

describe('a draft written since the page read it', () => {
  it('sends back the update date of the draft the page read', () => {
    const vm = page(jest.fn());

    expect(
      vm.readAtOf({ versionMajor: 1, versionMinor: 1, body: 'Typed' })
    ).toBe(READ_AT);
  });

  it('is told on the server’s refusal, and reloading shows it as it is now', async () => {
    const now = { expertiseId: 'qc.rules', versions: [draft({ body: 'Now' })] };
    const $get = jest.fn().mockResolvedValue(now);
    const vm = page($get);

    vm.handleError(refusal);
    expect(vm.draftChanged).toBe(true);
    expect(vm.exp.versions[0].body).toBe('Read');

    await vm.reloadItem();

    expect($get).toHaveBeenCalledWith('/ai-expertise/qc.rules');
    expect(vm.exp).toBe(now);
    expect(vm.draftChanged).toBe(false);
  });

  it('says it with a way to reload', async () => {
    const vm = mountSfc(
      'packages/ui/components/ai-skill/bs-ai-draft-changed-alert.vue',
      { mocks: { $t: (key) => key } }
    );
    const reload = jest.fn();
    vm.$on('reload', reload);
    await settle(vm);

    expect(vm.$el.textContent).toContain(
      'aiSkills.errors.SKILL_VERSION_CHANGED'
    );
    vm.$el.querySelector('v-btn').dispatchEvent(new Event('click'));
    expect(reload).toHaveBeenCalled();
  });

  it.each([
    ['packages/ui/routes/ai-expertise/_expertiseId/index.vue'],
    ['packages/ui/routes/ai-skills/_skillId/index.vue'],
  ])(
    '%s sends it with a save and a publication, and tells the refusal',
    (file) => {
      const source = fs.readFileSync(
        path.join(__dirname, '../../..', file),
        'utf8'
      );

      expect(source).toMatch(/updatedAt: this\.readAtOf\(version\)/);
      expect(source).toMatch(
        /\.\.\.payload, updatedAt: this\.readAtOf\(this\.activatingVersion\)/
      );
      expect(source).toMatch(
        /<bs-ai-draft-changed-alert\s+v-if="draftChanged"/
      );
    }
  );

  it.each([
    ['fr', /Rechargez-le/],
    ['en', /Reload it/],
  ])('is said in %s', (lang, said) => {
    const messages = require(`../../../packages/ui/helpers/locales/${lang}.js`)
      .default;

    expect(messages.aiSkills.errors.SKILL_VERSION_CHANGED).toMatch(said);
    expect(messages.aiSkills.version.reload).toBeTruthy();
  });
});
