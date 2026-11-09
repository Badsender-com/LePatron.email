/**
 * @jest-environment jsdom
 */
'use strict';

// The consent of a connected application (ADR 0012), mounted with the server
// simulated. Drafting skills and expertises (skills:write, ADR 0014) is
// offered to the one who may draft, by the design system's checkbox, unticked:
// the answer always says yes or no to it, never something else.

const Vue = require('vue');
const { mountSfc, settle } = require('../../helpers/mount-sfc.js');

const FILE = 'packages/ui/routes/oauth/consent/_uid.vue';

// What Vuetify's checkbox does: its `change` carries the new value.
Vue.component('VCheckbox', {
  props: { inputValue: Boolean },
  render(h) {
    return h(
      'button',
      {
        class: 'v-checkbox-stub',
        attrs: { 'aria-checked': String(this.inputValue) },
        on: { click: () => this.$emit('change', !this.inputValue) },
      },
      this.$scopedSlots.label ? this.$scopedSlots.label() : []
    );
  },
});

const interaction = (scopes) => ({
  client: { name: 'Claude', registration: 'metadataDocument', host: 'a.dev' },
  account: { name: 'Ada', email: 'ada@example.com' },
  groups: [{ id: 'g1', name: 'Company A' }],
  scopes,
  redirectHost: 'a.dev',
});

function mountConsent(scopes) {
  const $post = jest.fn().mockResolvedValue({ redirectTo: '#answered' });
  const vm = mountSfc(FILE, {
    mocks: {
      $t: (key) => key,
      $route: { params: { uid: 'u1' }, path: '/oauth/consent/u1' },
      $axios: {
        $get: jest.fn().mockResolvedValue(interaction(scopes)),
        $post,
      },
    },
    imports: {
      'lucide-vue': {},
      '~/helpers/api-routes.js': {
        oauthInteraction: (uid) => `/interaction/${uid}`,
        oauthInteractionConsent: (uid) => `/interaction/${uid}/consent`,
        oauthInteractionDeny: (uid) => `/interaction/${uid}/deny`,
      },
      '~/helpers/pages-acls.js': {},
      '~/components/account/login-logo.vue': {},
    },
  });
  return { vm, $post };
}

const allowButton = (vm) =>
  [...vm.$el.querySelectorAll('v-btn')].find((el) =>
    el.textContent.includes('oauthConsent.allowIn')
  );

describe('the consent of a connected application', () => {
  it('offers drafting with the design system checkbox, unticked', async () => {
    const { vm, $post } = mountConsent(['mcp:read', 'skills:write']);
    await settle(vm);

    const checkbox = vm.$el.querySelector('.v-checkbox-stub');
    expect(vm.$el.querySelector('input[type="checkbox"]')).toBeNull();
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    expect(checkbox.textContent).toContain('oauthConsent.allowWrite');

    allowButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);

    expect($post).toHaveBeenCalledWith('/interaction/u1/consent', {
      groupId: 'g1',
      allowWrite: false,
    });
  });

  it('grants drafting once ticked, as a boolean', async () => {
    const { vm, $post } = mountConsent(['mcp:read', 'skills:write']);
    await settle(vm);

    vm.$el.querySelector('.v-checkbox-stub').click();
    await settle(vm);
    allowButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);

    expect($post).toHaveBeenCalledWith('/interaction/u1/consent', {
      groupId: 'g1',
      allowWrite: true,
    });
  });

  it('offers no drafting to whoever may not draft', async () => {
    const { vm, $post } = mountConsent(['mcp:read']);
    await settle(vm);

    expect(vm.$el.querySelector('.v-checkbox-stub')).toBeNull();
    allowButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);

    expect($post).toHaveBeenCalledWith('/interaction/u1/consent', {
      groupId: 'g1',
      allowWrite: false,
    });
  });
});
