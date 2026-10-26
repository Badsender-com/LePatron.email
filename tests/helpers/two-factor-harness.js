'use strict';

// A stand-in for what a sign-in with two-factor authentication touches
// (epic #1318, ADR 0008): the accounts and groups in the database, the express
// request and its session, the answer. There is no test database, so the
// models are a small in-memory store, shared by the tests of the epic.
//
// The test files mock the models with it:
//   jest.mock('…/common/models.common.js', () =>
//     require('../../helpers/two-factor-harness.js').models
//   );

// The TOTP secret is encrypted with the application's key (ADR 0008).
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-of-32-bytes!';
}

const bcrypt = require('bcryptjs');

const fixtures = require('../fixtures/two-factor.js');

const { RFC_SECRET, RECOVERY_CODES, CHROME_ON_MAC } = fixtures;

const GROUP_ID = '507f1f77bcf86cd799439001';
const OTHER_GROUP_ID = '507f1f77bcf86cd799439002';

const users = new Map();
const groups = new Map();

// A Mongoose query: awaited as is, or after `select`, `lean` or `populate`.
function query(value) {
  const result = () => Promise.resolve(value);
  const q = {
    select: () => q,
    populate: () => q,
    lean: result,
    exec: result,
    then: (resolve, reject) => result().then(resolve, reject),
  };
  return q;
}

function setPath(target, dotted, value) {
  const keys = dotted.split('.');
  const last = keys.pop();
  const parent = keys.reduce((node, key) => {
    if (node[key] == null) node[key] = {};
    return node[key];
  }, target);
  if (value === undefined) delete parent[last];
  else parent[last] = value;
}

function applyUpdate(doc, update) {
  Object.entries(update.$set || {}).forEach(([key, value]) =>
    setPath(doc, key, value)
  );
  Object.keys(update.$unset || {}).forEach((key) =>
    setPath(doc, key, undefined)
  );
  Object.entries(update)
    .filter(([key]) => !key.startsWith('$'))
    .forEach(([key, value]) => setPath(doc, key, value));
}

const userOf = (filter = {}) => {
  if (filter._id) return users.get(String(filter._id)) || null;
  return (
    [...users.values()].find((user) =>
      Object.entries(filter).every(([key, value]) => {
        if (key === 'isDeactivated') return !user.isDeactivated;
        if (key === 'tokenExpire') return true;
        return user[key] === value;
      })
    ) || null
  );
};

const models = {
  Users: {
    findById: jest.fn((id) => query(users.get(String(id)) || null)),
    findOne: jest.fn((filter) => query(userOf(filter))),
    findOneForApi: jest.fn(async (filter) => userOf(filter)),
    updateOne: jest.fn(async (filter, update) => {
      const doc = userOf(filter);
      if (doc) applyUpdate(doc, update);
      return { modifiedCount: doc ? 1 : 0 };
    }),
  },
  Groups: {
    findById: jest.fn((id) => query(groups.get(String(id)) || null)),
    findOne: jest.fn((filter) => query(groups.get(String(filter._id)) || null)),
  },
  SecurityEvents: { create: jest.fn(async (event) => event) },
  Mailings: {},
  Templates: {},
  Profiles: {},
  OAuthClients: {},
  OAuthTokens: {},
};

function addGroup(overrides = {}) {
  const group = {
    _id: GROUP_ID,
    id: GROUP_ID,
    name: 'Client group',
    requireTwoFactor: true,
    ...overrides,
  };
  groups.set(String(group.id), group);
  return group;
}

function addUser(overrides = {}) {
  const user = {
    _id: 'u1',
    id: 'u1',
    name: 'Camille Martin',
    email: 'camille@client.test',
    lang: 'fr',
    role: 'regular_user',
    _company: GROUP_ID,
    group: GROUP_ID,
    isDeactivated: false,
    activeSessionId: 'previous-session',
    ...overrides,
  };
  user.save = jest.fn(async () => user);
  user.toJSON = () => {
    const plain = { ...user };
    ['save', 'toJSON', 'twoFactor', 'password', 'activeSessionId'].forEach(
      (key) => delete plain[key]
    );
    return plain;
  };
  user.setPassword = jest.fn(async (password) => {
    user.password = `hashed:${password}`;
    user.token = undefined;
    user.tokenExpire = undefined;
    return user;
  });
  user.deactivate = jest.fn(async () => {
    user.isDeactivated = true;
    user.password = undefined;
    return user;
  });
  user.activate = jest.fn(async () => {
    user.isDeactivated = false;
    return user;
  });
  users.set(String(user.id), user);
  return user;
}

// An account that set up the authenticator app with the RFC secret.
function addTotpUser(overrides = {}) {
  const { encrypt } = require('../../packages/server/utils/crypto.js');
  return addUser({
    twoFactorMethod: 'totp',
    twoFactor: {
      secret: encrypt(
        RFC_SECRET,
        `User:${overrides.id || 'u1'}:twoFactor.secret`
      ),
      recoveryCodes: RECOVERY_CODES.map((code) => ({
        hash: bcrypt.hashSync(code, 4),
      })),
      trustedDevices: [],
      failedPasswords: 0,
    },
    ...overrides,
  });
}

function makeRequest({
  session = {},
  body = {},
  cookies = {},
  params = {},
  user,
  userAgent = CHROME_ON_MAC,
} = {}) {
  const req = {
    session,
    body,
    cookies,
    params,
    user,
    ip: '203.0.113.7',
    connection: { remoteAddress: '203.0.113.7' },
    headers: { 'user-agent': userAgent },
    sessionID: 'new-session',
    get(name) {
      return this.headers[name.toLowerCase()];
    },
    isAuthenticated() {
      return !!this.user;
    },
  };
  const logIn = jest.fn((account, options, done) => {
    const callback = typeof options === 'function' ? options : done;
    req.user = account;
    callback();
  });
  req.logIn = logIn;
  req.login = logIn;
  if (!session.save) session.save = (done) => done && done();
  return req;
}

// Runs an express handler; resolves with the answer, rejects with the error
// handed to `next`.
function call(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      cookies: {},
      cleared: [],
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body, res: this });
        return this;
      },
      cookie(name, value, options) {
        this.cookies[name] = { value, options };
        return this;
      },
      clearCookie(name) {
        this.cleared.push(name);
        return this;
      },
      set() {
        return this;
      },
      on() {},
    };
    const next = (error) => (error ? reject(error) : resolve({ next: true }));
    Promise.resolve(handler(req, res, next)).catch(reject);
  });
}

// The password step: passport accepts `account`, then the login controller
// answers. `passport` is the mocked module of the test file.
function signIn(passport, account, requestOptions = {}) {
  const loginController = require('../../packages/server/user/user.controller.js')
    .login;
  passport.authenticate.mockImplementation((_strategy, done) => () =>
    done(null, account, null)
  );
  const req = makeRequest(requestOptions);
  return call(loginController, req).then((answer) => ({ req, answer }));
}

// The emailed code, read from the last email sent to `to`.
function lastEmailedCode(mail, to) {
  const sent = mail.send.mock.calls
    .map(([message]) => message)
    .filter((message) => message.to === to);
  const last = sent[sent.length - 1];
  const match = last && /\b(\d{6})\b/.exec(`${last.text} ${last.html}`);
  return match ? match[1] : null;
}

function reset() {
  users.clear();
  groups.clear();
  Object.values(models).forEach((model) =>
    Object.values(model).forEach((fn) => fn.mockClear && fn.mockClear())
  );
}

module.exports = {
  models,
  addGroup,
  addUser,
  addTotpUser,
  makeRequest,
  call,
  signIn,
  lastEmailedCode,
  reset,
  ...fixtures,
  GROUP_ID,
  OTHER_GROUP_ID,
};
