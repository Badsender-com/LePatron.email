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
    const setup = read('components/account/two-factor-methods.vue');

    expect(setup).toMatch(/v-for="option in \['totp', 'email'\]"/);
    expect(setup).toMatch(/type="radio"[\s\S]*?:value="option"/);
  });

  it('lets a member using email ask for a new code', () => {
    const code = read('components/account/two-factor-code.vue');

    expect(code).toMatch(
      /<bs-send-email-code[\s\S]*?v-if="method === 'email'"/
    );
  });

  it('waits before a new code, the first one being on its way', () => {
    // The server sends a code with the answer to the password, and only the
    // last code sent is valid: a new one asked at once would void it.
    [
      'components/account/two-factor-code.vue',
      'components/account/two-factor-setup.vue',
    ]
      .map(read)
      .forEach((step) =>
        expect(step).toMatch(/<bs-send-email-code[^>]*?\ssent-on-mount\b/)
      );
  });
});

describe('the sign-in card (after the consent of a connected application)', () => {
  let maskEmail;
  let groupKey;
  let initialsOfEmail;

  beforeAll(() => {
    ({
      maskEmail,
      groupKey,
      initialsOfEmail,
    } = require('../../../packages/ui/helpers/two-factor.js'));
  });

  it('says where a code went without showing the whole address', () => {
    expect(maskEmail('camille.martin@exemple.fr')).toBe('c•••@exemple.fr');
    expect(maskEmail('')).toBe('');
    expect(maskEmail('no-domain')).toBe('');
  });

  it('shows the key of the app in groups of four', () => {
    expect(groupKey('JBSWY3DPEHPK3PXPAB')).toBe('JBSW Y3DP EHPK 3PXP AB');
    expect(groupKey(undefined)).toBe('');
  });

  it('gives two letters to whoever signs in', () => {
    expect(initialsOfEmail('camille.martin@exemple.fr')).toBe('CM');
    expect(initialsOfEmail('jo@exemple.fr')).toBe('JO');
    expect(initialsOfEmail('')).toBe('?');
  });

  it('wraps every step of the login page in the same card', () => {
    const login = read('routes/account/login/index.vue');
    const steps = [
      'components/account/two-factor-code.vue',
      'components/account/two-factor-setup.vue',
      'components/account/recovery-codes.vue',
    ].map(read);

    expect(login.match(/<bs-auth-card/g)).toHaveLength(1);
    expect(read('components/account/login-password.vue')).toMatch(
      /<bs-auth-card/
    );
    steps.forEach((step) => expect(step).toMatch(/<bs-auth-card/));
  });

  it('lets the member change account rather than a bare arrow back', () => {
    const login = read('routes/account/login/index.vue');

    expect(login).not.toMatch(/lucide-arrow-left/);
    expect(login).toMatch(/@change-account="back"/);
  });

  it('lets the member change account from every step of the code', () => {
    const login = read('routes/account/login/index.vue');

    [
      'bs-login-password',
      'bs-two-factor-code',
      'bs-two-factor-setup',
    ].forEach((step) =>
      expect(login).toMatch(new RegExp(`<${step}[^>]*?@change-account="back"`))
    );
    ['two-factor-code.vue', 'two-factor-setup.vue']
      .map((file) => read(`components/account/${file}`))
      .forEach((step) =>
        expect(step).toMatch(
          /<bs-auth-card[^>]*?:email="email"[^>]*?@change-account="\$emit\('change-account'\)"/
        )
      );
  });

  it('keeps a refused code on its field, announced', () => {
    const field = read('components/account/auth-code-field.vue');
    const code = read('components/account/two-factor-code.vue');

    expect(field).toMatch(/role="alert"/);
    expect(field).toMatch(/:aria-describedby="describedBy"/);
    expect(code).toMatch(
      /this\.error = this\.\$t\(twoFactorErrorKey\(error\)\)/
    );
  });

  it('turns the recovery code into an action of its own', () => {
    const code = read('components/account/two-factor-code.vue');

    expect(code).toMatch(/@click="toggleRecovery"/);
    expect(code).toMatch(/twoFactor\.code\.useRecovery/);
  });

  it('goes on from the recovery codes only once they are noted', () => {
    const codes = read('components/account/recovery-codes.vue');

    expect(codes).toMatch(/:disabled="!noted"/);
  });
});

describe('the other sign-in pages', () => {
  it('take the same card', () => {
    [
      'routes/account/reset-password.vue',
      'routes/account/_email/password/_token.vue',
    ]
      .map(read)
      .forEach((page) => expect(page).toMatch(/<bs-auth-card/));
  });

  it('say in the card where the reset link went', () => {
    const reset = read('routes/account/reset-password.vue');

    expect(reset).toMatch(/this\.sentTo = this\.form\.email/);
    expect(reset).toMatch(/v-if="!sentTo"/);
  });

  it('offer a new link when the one followed no longer works', () => {
    const set = read('routes/account/_email/password/_token.vue');

    expect(set).toMatch(/v-if="linkExpired"/);
    expect(set).toMatch(/to="\/account\/reset-password"/);
  });

  it('say a wrong address in the page language, not the browser one', () => {
    // A native <form> lets the browser check `required` and `type="email"`
    // first; v-form turns that off, so vuelidate's messages show.
    const reset = read('routes/account/reset-password.vue');

    expect(reset).toMatch(/<v-form\s+id="reset-password-form"/);
    expect(reset).not.toMatch(/<form\b/);
  });

  it('carry no tagline under the logo', () => {
    [
      'components/account/auth-card.vue',
      'routes/account/reset-password.vue',
      'routes/account/_email/password/_token.vue',
    ]
      .map(read)
      .forEach((page) => expect(page).not.toMatch(/Builder by Badsender/));
  });
});

describe('a failed sign-in through the identity provider', () => {
  const server = fs.readFileSync(
    path.join(__dirname, '../../../packages/server/index.js'),
    'utf8'
  );

  it('lands on the login page, which says so', () => {
    const sso = fs.readFileSync(
      path.join(__dirname, '../../../packages/server/account/saml-account.js'),
      'utf8'
    );
    expect(sso).toMatch(
      /SSO_FAILURE_REDIRECT = '\/account\/login\?sso=failed'/
    );
    expect(server).toMatch(/SSO_FAILED = SSO_FAILURE_REDIRECT/);
    expect(server).not.toMatch(/failureRedirect: '\/'/);

    const login = read('routes/account/login/index.vue');
    expect(login).toMatch(/\$route\.query\.sso !== 'failed'/);
    expect(login).toMatch(/:alert="ssoFailed \? \$t\('authCard\.ssoFailed'\)/);
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

describe('the wording of the sign-in pages', () => {
  const en = require('../../../packages/ui/helpers/locales/en.js').default;
  const fr = require('../../../packages/ui/helpers/locales/fr.js').default;
  const valueAt = (locale, key) =>
    key.split('.').reduce((node, part) => node && node[part], locale);

  const filesIn = (dir) =>
    fs
      .readdirSync(path.join(__dirname, '../../../packages/ui', dir), {
        withFileTypes: true,
      })
      .flatMap((entry) => {
        const file = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return filesIn(file);
        return file.endsWith('.vue') ? [file] : [];
      });

  // Only the literal keys: a key built from a variable is checked where its
  // parts are.
  const keysOf = (source) => [
    ...[...source.matchAll(/\$tc?\(\s*'([^'$]+)'/g)].map((match) => match[1]),
    ...[...source.matchAll(/<i18n\s[^>]*?\bpath="([^"$`]+)"/g)].map(
      (match) => match[1]
    ),
  ];

  it('has every key in English and in French', () => {
    const missing = [
      ...filesIn('components/account'),
      ...filesIn('routes/account'),
    ].flatMap((file) =>
      keysOf(read(file)).flatMap((key) =>
        [
          ['en', en],
          ['fr', fr],
        ]
          .filter(([, locale]) => valueAt(locale, key) === undefined)
          .map(([name]) => `${file}: ${name} ${key}`)
      )
    );

    expect(missing).toEqual([]);
  });
});
