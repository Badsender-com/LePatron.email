'use strict';

// Ignoring a quality finding is shared by everyone who edits the email, so the
// endpoint takes the same access control as editing it. The access control is
// the real one (mailing.service): only the database and the two access
// services behind it are stubbed.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: { findOne: jest.fn(), updateOne: jest.fn() },
  Workspaces: {},
  Galleries: {},
  Folders: {},
  Groups: {},
  Templates: {},
  TaxonomyItems: {},
  Users: {},
  Profiles: {},
}));
jest.mock('../../../packages/server/folder/folder.service.js', () => ({
  hasAccess: jest.fn(),
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  hasAccess: jest.fn(),
}));
jest.mock('../../../packages/server/group/group.service.js', () => ({}));
jest.mock('../../../packages/server/user/user.service.js', () => ({}));
jest.mock('../../../packages/server/profile/profile.service.js', () => ({}));
jest.mock(
  '../../../packages/server/emails-group/emails-group.service.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/personalized-variables/personalized-variable.service.js',
  () => ({})
);
jest.mock('../../../packages/server/group/group-ftp.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mongoose = require('mongoose');
const {
  Mailings,
} = require('../../../packages/server/common/models.common.js');
const workspaceService = require('../../../packages/server/workspace/workspace.service.js');
const folderService = require('../../../packages/server/folder/folder.service.js');
const controller = require('../../../packages/server/mailing/mailing-quality.controller.js');
const {
  validateIgnorePayload,
  ruleIdOf,
  setIgnored,
  MAX_QUALITY_IGNORES,
  IGNORE_PROJECTION,
} = require('../../../packages/server/mailing/mailing-quality.service.js');

const MAILING_ID = '507f1f77bcf86cd799439001';
const WORKSPACE_ID = '507f1f77bcf86cd799439301';
const user = { id: 'user-1', isAdmin: false, group: { id: 'group-1' } };
const FINGERPRINT = 'unfilled-links|ko_textBlock_1|-|1x2y3z|1';

// The document as the projected read returns it: no content.
const storedMailing = (overrides = {}) => ({
  _id: mongoose.Types.ObjectId(MAILING_ID),
  _company: 'group-1',
  _workspace: WORKSPACE_ID,
  ...overrides,
});

function stubDatabase({ mailing = storedMailing(), stored = [] } = {}) {
  // The first read decides the right; the second, after the write, answers.
  Mailings.findOne.mockImplementation((query, projection) =>
    Promise.resolve(
      projection === IGNORE_PROJECTION
        ? mailing
        : { qualityIgnores: stored.map((fingerprint) => ({ fingerprint })) }
    )
  );
  Mailings.updateOne.mockResolvedValue({ nModified: 1 });
}

async function callEndpoint(body, who = user) {
  const res = { json: jest.fn() };
  let error;
  await controller.updateQualityIgnores(
    { params: { mailingId: MAILING_ID }, body, user: who },
    res,
    (err) => {
      error = err;
    }
  );
  return {
    error,
    payload: res.json.mock.calls[0] && res.json.mock.calls[0][0],
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  workspaceService.hasAccess.mockResolvedValue(true);
});

describe('validateIgnorePayload', () => {
  it('accepts a fingerprint and what to do', () => {
    expect(
      validateIgnorePayload({ fingerprint: FINGERPRINT, ignored: true })
    ).toEqual({ fingerprint: FINGERPRINT, ignored: true });
  });

  it.each([
    [{}],
    [{ fingerprint: '', ignored: true }],
    [{ fingerprint: FINGERPRINT }],
    [{ fingerprint: FINGERPRINT, ignored: 'yes' }],
    [{ fingerprint: 'x'.repeat(513), ignored: true }],
    // The rule is read from the fingerprint, never taken from the request.
    [{ fingerprint: FINGERPRINT, ruleId: 'unfilled-links', ignored: true }],
    [{ fingerprint: FINGERPRINT, ignored: true, data: {} }],
  ])('refuses %j', (payload) => {
    expect(() => validateIgnorePayload(payload)).toThrow(
      expect.objectContaining({
        status: 422,
        message: 'INVALID_QUALITY_IGNORE',
      })
    );
  });
});

describe('ruleIdOf', () => {
  it('reads the rule that opens the fingerprint', () => {
    expect(ruleIdOf(FINGERPRINT)).toBe('unfilled-links');
    expect(ruleIdOf('Not A Rule|b1|-|x')).toBeNull();
  });
});

describe('setIgnored', () => {
  it('adds the finding once, in one atomic update bounded by the ceiling', async () => {
    stubDatabase({ stored: [FINGERPRINT] });

    const kept = await setIgnored(
      MAILING_ID,
      { fingerprint: FINGERPRINT, ignored: true },
      user
    );

    expect(Mailings.updateOne).toHaveBeenCalledWith(
      { _id: MAILING_ID, 'qualityIgnores.fingerprint': { $ne: FINGERPRINT } },
      {
        $push: {
          qualityIgnores: {
            $each: [
              expect.objectContaining({
                fingerprint: FINGERPRINT,
                ruleId: 'unfilled-links',
                _user: 'user-1',
                ignoredAt: expect.any(Date),
              }),
            ],
            $slice: -MAX_QUALITY_IGNORES,
          },
        },
      }
    );
    expect(kept).toEqual([FINGERPRINT]);
  });

  it('is idempotent: ignoring twice sends the same guarded update, never a save', async () => {
    stubDatabase({ stored: [FINGERPRINT] });
    const change = { fingerprint: FINGERPRINT, ignored: true };

    const [first, second] = await Promise.all([
      setIgnored(MAILING_ID, change, user),
      setIgnored(MAILING_ID, change, user),
    ]);

    expect(first).toEqual([FINGERPRINT]);
    expect(second).toEqual([FINGERPRINT]);
    expect(Mailings.updateOne).toHaveBeenCalledTimes(2);
    Mailings.updateOne.mock.calls.forEach(([filter]) => {
      expect(filter['qualityIgnores.fingerprint']).toEqual({
        $ne: FINGERPRINT,
      });
    });
  });

  it('lets two overlapping changes through, each in its own update', async () => {
    stubDatabase({ stored: [FINGERPRINT, 'other|b2|-|y|1'] });

    const results = await Promise.all([
      setIgnored(MAILING_ID, { fingerprint: FINGERPRINT, ignored: true }, user),
      setIgnored(
        MAILING_ID,
        { fingerprint: 'other|b2|-|y|1', ignored: true },
        user
      ),
    ]);

    expect(Mailings.updateOne).toHaveBeenCalledTimes(2);
    results.forEach((kept) =>
      expect(kept).toEqual([FINGERPRINT, 'other|b2|-|y|1'])
    );
  });

  it('releases a finding with a pull', async () => {
    stubDatabase({ stored: [] });

    const kept = await setIgnored(
      MAILING_ID,
      { fingerprint: FINGERPRINT, ignored: false },
      user
    );

    expect(Mailings.updateOne).toHaveBeenCalledWith(
      { _id: MAILING_ID },
      { $pull: { qualityIgnores: { fingerprint: FINGERPRINT } } }
    );
    expect(kept).toEqual([]);
  });

  it('reads back the fingerprints only', async () => {
    stubDatabase({ stored: [FINGERPRINT] });
    await setIgnored(
      MAILING_ID,
      { fingerprint: FINGERPRINT, ignored: true },
      user
    );

    expect(Mailings.findOne).toHaveBeenCalledWith(
      { _id: MAILING_ID },
      { 'qualityIgnores.fingerprint': 1 }
    );
  });
});

describe('PATCH /mailings/:mailingId/quality-ignores', () => {
  it('reads only what the right needs, stores the change and answers with the fingerprints', async () => {
    stubDatabase({ stored: [FINGERPRINT] });

    const { error, payload } = await callEndpoint({
      fingerprint: FINGERPRINT,
      ignored: true,
    });

    expect(error).toBeUndefined();
    expect(Mailings.findOne).toHaveBeenNthCalledWith(
      1,
      { _id: mongoose.Types.ObjectId(MAILING_ID), _company: 'group-1' },
      IGNORE_PROJECTION
    );
    expect(workspaceService.hasAccess).toHaveBeenCalledWith(user, WORKSPACE_ID);
    expect(payload).toEqual({ qualityIgnores: [FINGERPRINT] });
  });

  it('answers 404 to a user of another company, as the tenant filter hides the email', async () => {
    stubDatabase({ mailing: null });

    const { error } = await callEndpoint({
      fingerprint: FINGERPRINT,
      ignored: true,
    });

    expect(error.status).toBe(404);
    expect(Mailings.updateOne).not.toHaveBeenCalled();
  });

  it('answers 403 to a user of the company without access to the workspace', async () => {
    stubDatabase();
    workspaceService.hasAccess.mockResolvedValue(false);

    const { error } = await callEndpoint({
      fingerprint: FINGERPRINT,
      ignored: true,
    });

    expect(error.status).toBe(403);
    expect(Mailings.updateOne).not.toHaveBeenCalled();
  });

  it('takes the folder into account when the email lives in one', async () => {
    stubDatabase({
      mailing: storedMailing({ _workspace: undefined, _parentFolder: 'f1' }),
      stored: [FINGERPRINT],
    });
    folderService.hasAccess.mockResolvedValue(true);

    const { error } = await callEndpoint({
      fingerprint: FINGERPRINT,
      ignored: true,
    });

    expect(error).toBeUndefined();
    expect(folderService.hasAccess).toHaveBeenCalledWith('f1', user);
  });

  it('answers 404 on a malformed id, before any read', async () => {
    const res = { json: jest.fn() };
    let error;
    await controller.updateQualityIgnores(
      {
        params: { mailingId: 'not-an-id' },
        body: { fingerprint: FINGERPRINT, ignored: true },
        user,
      },
      res,
      (err) => {
        error = err;
      }
    );
    expect(error.status).toBe(404);
    expect(Mailings.findOne).not.toHaveBeenCalled();
  });

  it('reads nothing when the payload is invalid', async () => {
    const { error } = await callEndpoint({ fingerprint: FINGERPRINT });

    expect(error.status).toBe(422);
    expect(Mailings.findOne).not.toHaveBeenCalled();
  });
});
