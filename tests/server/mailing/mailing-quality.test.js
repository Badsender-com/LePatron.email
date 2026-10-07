'use strict';

// Ignoring a quality finding is shared by everyone who edits the email, so the
// endpoint takes the same access control as editing it: pinned below, along
// with the payload validation and what the response carries.

jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  findOneForUser: jest.fn(),
  assertUserCanEditMailing: jest.fn(),
}));

const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const controller = require('../../../packages/server/mailing/mailing-quality.controller.js');
const {
  validateIgnorePayload,
  applyIgnore,
  MAX_QUALITY_IGNORES,
} = require('../../../packages/server/mailing/mailing-quality.service.js');

const MAILING_ID = '507f1f77bcf86cd799439001';
const user = { id: 'user-1', isAdmin: false };
const FINGERPRINT = 'unfilled-links|ko_textBlock_1|-|1x2y3z';

function makeMailing(overrides = {}) {
  return {
    id: MAILING_ID,
    data: { big: 'model' },
    previewHtml: '<html>rendered</html>',
    save: jest.fn(),
    ...overrides,
  };
}

async function callEndpoint(mailing, body) {
  mailingService.findOneForUser.mockResolvedValue(mailing);
  const res = { json: jest.fn() };
  let error;
  await controller.updateQualityIgnores(
    { params: { mailingId: MAILING_ID }, body, user },
    res,
    (err) => {
      error = err;
    }
  );
  return {
    res,
    error,
    payload: res.json.mock.calls[0] && res.json.mock.calls[0][0],
  };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('validateIgnorePayload', () => {
  it('accepts a fingerprint, a rule id and what to do', () => {
    expect(
      validateIgnorePayload({
        fingerprint: FINGERPRINT,
        ruleId: 'unfilled-links',
        ignored: true,
      })
    ).toEqual({
      fingerprint: FINGERPRINT,
      ruleId: 'unfilled-links',
      ignored: true,
    });
  });

  it.each([
    [{}],
    [{ fingerprint: '', ignored: true }],
    [{ fingerprint: FINGERPRINT }],
    [{ fingerprint: FINGERPRINT, ignored: 'yes' }],
    [{ fingerprint: 'x'.repeat(513), ignored: true }],
    [{ fingerprint: FINGERPRINT, ruleId: 'Not A Rule!', ignored: true }],
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

describe('applyIgnore', () => {
  it('ignores a finding once, and releases it', () => {
    const mailing = makeMailing();
    const change = {
      fingerprint: FINGERPRINT,
      ruleId: 'unfilled-links',
      ignored: true,
    };

    expect(applyIgnore(mailing, change, user)).toEqual([FINGERPRINT]);
    expect(applyIgnore(mailing, change, user)).toEqual([FINGERPRINT]);
    expect(mailing.qualityIgnores[0]).toMatchObject({
      ruleId: 'unfilled-links',
      _user: 'user-1',
    });

    expect(applyIgnore(mailing, { ...change, ignored: false }, user)).toEqual(
      []
    );
  });

  it('lets the oldest go at the ceiling, so ignoring keeps working', () => {
    const mailing = makeMailing({
      qualityIgnores: Array.from({ length: MAX_QUALITY_IGNORES }, (_, i) => ({
        fingerprint: `f${i}`,
      })),
    });
    const fingerprints = applyIgnore(
      mailing,
      { fingerprint: 'one-more', ruleId: null, ignored: true },
      user
    );
    expect(fingerprints).toHaveLength(MAX_QUALITY_IGNORES);
    expect(fingerprints[0]).toBe('f1');
    expect(fingerprints[fingerprints.length - 1]).toBe('one-more');
  });
});

describe('PATCH /mailings/:mailingId/quality-ignores', () => {
  it('saves the change and answers with the ignored fingerprints only', async () => {
    const mailing = makeMailing();
    const { payload } = await callEndpoint(mailing, {
      fingerprint: FINGERPRINT,
      ignored: true,
    });

    expect(mailingService.assertUserCanEditMailing).toHaveBeenCalledWith(
      user,
      mailing
    );
    expect(mailing.save).toHaveBeenCalled();
    expect(payload).toEqual({ qualityIgnores: [FINGERPRINT] });
  });

  it('saves nothing when the user cannot edit the email', async () => {
    const mailing = makeMailing();
    mailingService.assertUserCanEditMailing.mockRejectedValue(
      Object.assign(new Error('FORBIDDEN'), { status: 403 })
    );
    const { error } = await callEndpoint(mailing, {
      fingerprint: FINGERPRINT,
      ignored: true,
    });

    expect(error.status).toBe(403);
    expect(mailing.save).not.toHaveBeenCalled();
  });

  it('reads nothing when the payload is invalid', async () => {
    const { error } = await callEndpoint(makeMailing(), {
      fingerprint: FINGERPRINT,
    });

    expect(error.status).toBe(422);
    expect(mailingService.findOneForUser).not.toHaveBeenCalled();
  });
});
