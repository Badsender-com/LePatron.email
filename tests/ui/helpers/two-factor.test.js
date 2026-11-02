'use strict';

// The login page after the password (epic #1318, ADR 0008): the server's
// answer says what comes next, the code, the setup, the new recovery codes,
// or nothing, the member being signed in.
//
// The project has no @vue/test-utils: the step comes from a helper, and the
// page's template is read from its source.

const fs = require('fs');
const path = require('path');

const read = (file) =>
  fs.readFileSync(path.join(__dirname, '../../../packages/ui', file), 'utf8');

let signInStepOf;

describe('the step after the password', () => {
  beforeAll(() => {
    // Required here, not at the top: the helper ships with #1320.
    ({ signInStepOf } = require('../../../packages/ui/helpers/two-factor.js'));
  });

  it('asks the code', () => {
    expect(
      signInStepOf({ twoFactor: { step: 'verify', method: 'totp' } })
    ).toBe('verify');
  });

  it('asks the setup', () => {
    expect(signInStepOf({ twoFactor: { step: 'setup' } })).toBe('setup');
  });

  it('shows the new recovery codes before going on', () => {
    expect(signInStepOf({ id: 'u1', recoveryCodes: ['ABCD-EFGH'] })).toBe(
      'recovery-codes'
    );
  });

  it('goes on once signed in', () => {
    expect(signInStepOf({ id: 'u1' })).toBe('signed-in');
  });
});

describe('the login page', () => {
  const login = read('routes/account/login/index.vue');

  it('shows the code, the setup and the recovery codes as the step says', () => {
    expect(login).toMatch(
      /<bs-two-factor-code[\s\S]*?v-if="step === 'verify'"/
    );
    expect(login).toMatch(
      /<bs-two-factor-setup[\s\S]*?v-if="step === 'setup'"/
    );
    expect(login).toMatch(
      /<bs-recovery-codes[\s\S]*?v-if="step === 'recovery-codes'"/
    );
  });

  it('sends a member back to the login page after the password link, when the group requires it', () => {
    const link = read('routes/account/_email/password/_token.vue');

    expect(link).toMatch(/twoFactorRequired[\s\S]*?\/account\/login/);
  });

  it('shows in the users table whether each member set it up', () => {
    const table = read('components/users/table.vue');

    expect(table).toMatch(/value: 'twoFactorMethod'/);
  });
});

describe('choosing the verification method', () => {
  it('offers the authenticator app and the code by email', () => {
    const setup = read('components/account/two-factor-setup.vue');

    expect(setup).toMatch(/value="totp"/);
    expect(setup).toMatch(/value="email"/);
  });

  it('lets a member using email ask for a new code', () => {
    const code = read('components/account/two-factor-code.vue');

    expect(code).toMatch(
      /<bs-send-email-code[\s\S]*?v-if="method === 'email'"/
    );
  });
});

describe('the 401 of the step of the code', () => {
  let onError;
  let redirected;

  beforeAll(() => {
    const plugin = require('../../../packages/ui/plugins/axios-error-handler.js')
      .default;
    plugin({ $axios: { onError: (handler) => (onError = handler) } });
  });

  beforeEach(() => {
    redirected = false;
    const location = {};
    Object.defineProperty(location, 'href', {
      get: () => '',
      set: () => {
        redirected = true;
      },
    });
    global.window = { location };
  });

  afterEach(() => {
    delete global.window;
  });

  it('leaves the login page to say the step ended, without a reload', () => {
    onError({
      response: { status: 401 },
      config: { url: '/account/login/two-factor' },
    });

    expect(redirected).toBe(false);
  });

  it('still sends a signed-out request elsewhere to the login page', () => {
    onError({ response: { status: 401 }, config: { url: '/mailings' } });

    expect(redirected).toBe(true);
  });
});
