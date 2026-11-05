'use strict';

// The stdio bridge reads as whichever account its command line names, so it
// runs only when NODE_ENV says development explicitly, and against a database
// on this machine only, unless told otherwise on purpose. It never prints the
// database's URI, which may carry credentials.

const {
  isLocalDatabase,
  assertMayRun,
} = require('../../scripts/mcp-dev-stdio.js');

const REMOTE = 'mongodb://admin:s3cret@db.example.test:27017/lepatron';
const LOCAL = 'mongodb://localhost/lepatron';
const DEV = { isDev: true };
const DEV_ENV = { NODE_ENV: 'development' };

describe('mcp-dev-stdio', () => {
  it.each([
    'mongodb://localhost:27017/lepatron',
    'mongodb://127.0.0.1/lepatron',
    'mongodb://user:pass@[::1]:27017/lepatron?authSource=admin',
    'mongodb://localhost:27017,127.0.0.1:27018/lepatron',
  ])('takes %s for a local database', (uri) => {
    expect(isLocalDatabase(uri)).toBe(true);
  });

  it.each([
    REMOTE,
    'mongodb://localhost:27017,db.example.test:27017/lepatron',
    'mongodb+srv://cluster.example.test/lepatron',
    'mongodb://localhost.example.test/lepatron',
    undefined,
  ])('does not take %s for a local database', (uri) => {
    expect(isLocalDatabase(uri)).toBe(false);
  });

  it('runs against a local database', () => {
    expect(() =>
      assertMayRun({ ...DEV, database: LOCAL }, [], DEV_ENV)
    ).not.toThrow();
  });

  it('refuses a remote database without saying so on purpose, and never names it', () => {
    const run = () => assertMayRun({ ...DEV, database: REMOTE }, [], DEV_ENV);

    expect(run).toThrow(/local database only/);
    expect(run).not.toThrow(/s3cret|example\.test/);
  });

  it('runs against a remote database when told so on purpose', () => {
    expect(() =>
      assertMayRun(
        { ...DEV, database: REMOTE },
        ['--allow-remote-database'],
        DEV_ENV
      )
    ).not.toThrow();
  });

  it.each([
    ['NODE_ENV left unset', {}],
    ['NODE_ENV set to production', { NODE_ENV: 'production' }],
    ['NODE_ENV set to test', { NODE_ENV: 'test' }],
  ])('never runs with %s', (_case, env) => {
    expect(() =>
      assertMayRun(
        { ...DEV, database: LOCAL },
        ['--allow-remote-database'],
        env
      )
    ).toThrow(/development only/);
  });

  it('never runs when the configuration is not development', () => {
    expect(() =>
      assertMayRun({ isDev: false, database: LOCAL }, [], DEV_ENV)
    ).toThrow(/development only/);
  });
});
