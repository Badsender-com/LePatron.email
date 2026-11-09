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

function mountConsent(
  scopes,
  {
    $get = jest.fn().mockResolvedValue(interaction(scopes)),
    $post = jest.fn().mockResolvedValue({ redirectTo: '#answered' }),
  } = {}
) {
  const vm = mountSfc(FILE, {
    mocks: {
      $t: (key) => key,
      $route: { params: { uid: 'u1' }, path: '/oauth/consent/u1' },
      $axios: { $get, $post },
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

// What the consent API answers a refusal: its status, and the code the page
// translates (ERROR_CODES.MCP_CONSENT_…).
const refusal = (status, code) =>
  Object.assign(new Error(code), {
    response: { status, data: { message: code, code } },
  });

const buttonOf = (vm, label) =>
  [...vm.$el.querySelectorAll('v-btn')].find((el) =>
    el.textContent.includes(label)
  );

describe('the consent of a connected application, refused', () => {
  it.each([
    [404, 'expired', 'oauthConsent.expired'],
    [401, 'sign_in_required', 'oauthConsent.signInRequired'],
    [403, 'account_cannot_connect', 'oauthConsent.accountCannotConnect'],
    [403, 'no_mcp_access', 'oauthConsent.noAccess'],
    [403, 'client_of_another_company', 'oauthConsent.clientOfAnotherCompany'],
  ])('says why, on a %s %s', async (status, code, text) => {
    const $get = jest.fn().mockRejectedValue(refusal(status, code));
    const { vm } = mountConsent([], { $get });
    await settle(vm);

    expect(vm.$el.querySelector('.bs-oauth-consent__message').textContent).toBe(
      text
    );
  });

  it('says why the consent itself is refused', async () => {
    const $post = jest
      .fn()
      .mockRejectedValue(refusal(400, 'read_scope_required'));
    const { vm } = mountConsent(['mcp:read'], { $post });
    await settle(vm);

    allowButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);

    expect(vm.$el.querySelector('.bs-oauth-consent__message').textContent).toBe(
      'oauthConsent.readScopeRequired'
    );
  });

  it('still lets the user decline, which answers the application', async () => {
    const $get = jest.fn().mockRejectedValue(refusal(403, 'no_mcp_access'));
    const { vm, $post } = mountConsent([], { $get });
    await settle(vm);

    buttonOf(vm, 'oauthConsent.deny').dispatchEvent(new Event('click'));
    await settle(vm);

    expect($post).toHaveBeenCalledWith('/interaction/u1/deny', undefined);
  });

  it('offers no answer to a request that has expired', async () => {
    const $get = jest.fn().mockRejectedValue(refusal(404, 'expired'));
    const { vm } = mountConsent([], { $get });
    await settle(vm);

    expect(buttonOf(vm, 'oauthConsent.deny')).toBeUndefined();
  });

  it('offers no answer once the decline finds the request expired', async () => {
    const $get = jest.fn().mockRejectedValue(refusal(403, 'no_mcp_access'));
    const $post = jest.fn().mockRejectedValue(refusal(404, 'expired'));
    const { vm } = mountConsent([], { $get, $post });
    await settle(vm);

    buttonOf(vm, 'oauthConsent.deny').dispatchEvent(new Event('click'));
    await settle(vm);

    expect(vm.$el.querySelector('.bs-oauth-consent__message').textContent).toBe(
      'oauthConsent.expired'
    );
    expect(buttonOf(vm, 'oauthConsent.deny')).toBeUndefined();
  });
});
