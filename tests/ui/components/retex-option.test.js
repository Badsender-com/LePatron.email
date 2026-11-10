/**
 * @jest-environment jsdom
 */
'use strict';

// The retex switch of a company (ADR 0012), mounted: beside it, the admin
// reads that the rating and the comment of a feedback reach the platform
// company whether the retex is allowed or not, and what turning it off
// erases; switching it saves it on its own.

const { mountSfc, componentOf, settle } = require('../../helpers/mount-sfc.js');
const mixinGroupSwitch = require('../../../packages/ui/helpers/mixins/mixin-group-switch.js');
const fr = require('../../../packages/ui/helpers/locales/fr.js').default;
const en = require('../../../packages/ui/helpers/locales/en.js').default;

function mountOption(group, $put) {
  const commit = jest.fn();
  return mountSfc('packages/ui/components/group/retex-option.vue', {
    props: { group },
    mocks: {
      $t: (key) => key,
      $axios: { $put },
      // What mapMutations reads of the store's `page` module.
      $store: {
        commit,
        _modulesNamespaceMap: { 'page/': { context: { commit } } },
      },
    },
    imports: {
      '~/helpers/mixins/mixin-group-switch.js': mixinGroupSwitch,
      '~/components/layout/bs-settings-row.vue': componentOf(
        'packages/ui/components/layout/bs-settings-row.vue'
      ),
    },
  });
}

describe('the retex option of a company', () => {
  it('says beside the switch what is always shared, and what turning it off erases', async () => {
    const vm = mountOption({ id: 'g1', allowRetex: false }, jest.fn());
    await settle(vm);

    const said = vm.$el.querySelector('.bs-settings-row__description');
    expect(vm.$el.querySelector('v-switch')).not.toBeNull();
    expect(said.textContent).toContain('retex.alwaysShared');
    expect(said.textContent).toContain('retex.offForgets');
  });

  it('saves the switch on its own, and tells the page', async () => {
    const saved = { id: 'g1', allowRetex: true };
    const $put = jest.fn().mockResolvedValue(saved);
    const vm = mountOption({ id: 'g1', allowRetex: false }, $put);
    const update = jest.fn();
    vm.$on('update', update);

    vm.$el.querySelector('v-switch').dispatchEvent(new Event('change'));
    await settle(vm);

    expect($put).toHaveBeenCalledWith(expect.any(String), { allowRetex: true });
    expect(update).toHaveBeenCalledWith(saved);
  });

  it.each([
    [
      'fr',
      fr,
      /note et le commentaire.*entreprise plateforme/,
      /efface les retours d'expérience.*utilisateurs.*ouverts ou clos.*consultant.*restent/,
      /divergence ou un complément.*approuve chaque retour/,
    ],
    [
      'en',
      en,
      /rating and the comment.*platform company/,
      /erases the retex.*users.*open or closed.*consultant.*stay/,
      /divergence or a complement.*approves each retex/,
    ],
  ])(
    'says it in %s, as the retex is now (ADR 0021)',
    (_lang, messages, shared, erased, described) => {
      expect(messages.retex.alwaysShared).toMatch(shared);
      expect(messages.retex.offForgets).toMatch(erased);
      expect(messages.retex.description).toMatch(described);
      const said = Object.values(messages.retex).join(' ');
      expect(said).not.toMatch(/résumé de sa session|summary of their session/);
      expect(said).not.toMatch(/500/);
    }
  );
});
