'use strict';

// The development defaults of node.config.js are public: anywhere but in
// development and the tests, the server refuses to start on them.

const {
  assertNoDevDefaults,
  DEFAULTS,
} = require('../../../packages/server/config/dev-defaults.js');

// What the check reads: the configuration, and NODE_ENV as the process got it.
const assertProductionSecrets = (config) =>
  assertNoDevDefaults(config, config.NODE_ENV);

const configured = (overrides = {}) => ({
  isDev: false,
  NODE_ENV: 'production',
  sessionSecret: 'a-secret-of-the-deployment',
  admin: { password: 'a-password-of-the-deployment' },
  ...overrides,
});

describe('starting outside development', () => {
  it('starts with the secrets of the deployment', () => {
    expect(() => assertProductionSecrets(configured())).not.toThrow();
  });

  it('refuses the default session secret, naming its variable', () => {
    expect(() =>
      assertProductionSecrets(
        configured({ sessionSecret: DEFAULTS.sessionSecret })
      )
    ).toThrow(/lepatron_sessionSecret/);
  });

  it("refuses the default password of the configuration's admin", () => {
    expect(() =>
      assertProductionSecrets(configured({ admin: { password: 'admin' } }))
    ).toThrow(/lepatron_admin__password/);
  });

  it('refuses a secret left empty', () => {
    expect(() =>
      assertProductionSecrets(configured({ sessionSecret: '' }))
    ).toThrow(/lepatron_sessionSecret/);
  });

  it('refuses on a pre-production too', () => {
    expect(() =>
      assertProductionSecrets(
        configured({
          NODE_ENV: 'staging',
          sessionSecret: DEFAULTS.sessionSecret,
        })
      )
    ).toThrow();
  });
});

describe('starting without NODE_ENV', () => {
  it('refuses the defaults: an unset environment is not a developer machine', () => {
    expect(() =>
      assertNoDevDefaults(
        {
          isDev: true,
          sessionSecret: DEFAULTS.sessionSecret,
          admin: { password: 'admin' },
        },
        undefined
      )
    ).toThrow(/NODE_ENV=development/);
  });
});

describe('starting in development or in the tests', () => {
  it.each([
    [{ isDev: true, NODE_ENV: 'development' }],
    [{ isDev: false, NODE_ENV: 'test' }],
  ])('accepts the defaults (%o)', (environment) => {
    expect(() =>
      assertProductionSecrets({
        ...environment,
        sessionSecret: DEFAULTS.sessionSecret,
        admin: { password: 'admin' },
      })
    ).not.toThrow();
  });
});
