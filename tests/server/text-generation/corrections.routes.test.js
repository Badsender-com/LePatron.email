'use strict';

/**
 * Acceptance tests of the spelling correction (epic #1251, ADR 0005), at its
 * HTTP seam.
 *
 * The module boundaries are mocked, as for the subject and the preheader: these
 * tests pin the status codes, what the skill is given, and which corrections
 * reach the editor. A correction the code cannot place in the text — missing,
 * found twice, touching a merge tag, changing nothing, on a field that was not
 * sent — is dropped and counted.
 */

const createError = require('http-errors');

jest.mock(
  '../../../packages/server/ai-skill/services/skill-invocation.service',
  () => ({ invoke: jest.fn() })
);
jest.mock(
  '../../../packages/server/ai-skill/repositories/expertise.repository',
  () => ({ findApplicable: jest.fn() })
);
jest.mock('../../../packages/server/mailing/mailing.service', () => ({
  findOneForUser: jest.fn(),
  assertUserCanEditMailing: jest.fn(),
}));
jest.mock('../../../packages/server/mailing/mailing-metadata.service', () => ({
  findCanonicalEmailType: jest.fn(),
}));
jest.mock('../../../packages/server/common/models.common.js', () => ({
  Templates: { findById: jest.fn() },
}));
jest.mock('../../../packages/server/account/auth.guard', () => ({
  GUARD_USER: function GUARD_USER(req, res, next) {
    if (req.user) return next();
    return res.status(401).json({ message: 'Unauthorized' });
  },
}));
// The AI rate limit has its own tests: here it only has to be on the route.
jest.mock('../../../packages/server/ai-usage/ai-rate-limit.js', () => ({
  aiRateLimit: () =>
    function aiRateLimitMiddleware(req, res, next) {
      next();
    },
}));

const express = require('express');
const request = require('supertest');
const { routeInspector } = require('../../helpers/express-router');

const USER = { id: 'u1', group: { id: 'g1' } };
const MAILING_ID = '6500000000000000000000aa';

const TARGET = {
  kind: 'block',
  blockId: 'ko_textBlock_3',
  blockType: 'textBlock',
};

// The visible text of each field, as the editor sends it.
const FIELDS = [
  { path: 'titleText', role: 'title', text: 'Les soldes commence demain' },
  {
    path: 'longText',
    role: 'text',
    text: 'Bonjour {{prenom}}, profitez de -30 % sur la colection lin.',
  },
];

const body = { mailingId: MAILING_ID, target: TARGET, fields: FIELDS };

let invoke;
let findApplicable;
let mailingService;
let mailingMetadataService;
let textGenerationRouter;

function makeApp({ user = USER } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/api/text-generation', textGenerationRouter);
  // Same contract as the server's apiErrorHandler: status and message.
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return app;
}

function corrections(...items) {
  return {
    output: { corrections: items },
    invocationId: 'inv1',
  };
}

const fix = (field, before, after, reason = 'Orthographe') => ({
  field,
  before,
  after,
  reason,
});

// Errors as skill invocation throws them (see skill-invocation.service).
function engineOff(reason) {
  const err = createError(
    400,
    "Group g1 has no active 'text_generation' feature"
  );
  err.invocationStatus = 'CONFIG_ERROR';
  err.featureResolutionReason = reason;
  return err;
}
function skillMissing() {
  const err = createError(
    404,
    'Skill "redaction.correction" not found or not ACTIVE'
  );
  err.invocationStatus = 'CONFIG_ERROR';
  return err;
}
function loadModules() {
  jest.resetModules();
  ({
    invoke,
  } = require('../../../packages/server/ai-skill/services/skill-invocation.service'));
  ({
    findApplicable,
  } = require('../../../packages/server/ai-skill/repositories/expertise.repository'));
  mailingService = require('../../../packages/server/mailing/mailing.service');
  mailingMetadataService = require('../../../packages/server/mailing/mailing-metadata.service');
  textGenerationRouter = require('../../../packages/server/text-generation/text-generation.routes');

  mailingService.findOneForUser.mockResolvedValue({ id: MAILING_ID });
  mailingService.assertUserCanEditMailing.mockResolvedValue();
  mailingMetadataService.findCanonicalEmailType.mockResolvedValue(
    'promotional'
  );
  // No expertise of scope `correction` today (ADR 0005).
  findApplicable.mockResolvedValue([]);
}

const post = (payload = body, app = makeApp()) =>
  request(app).post('/api/text-generation/corrections').send(payload);

// Turned on by #1254 (correct a field)
describe.skip('spelling correction: POST /api/text-generation/corrections', () => {
  beforeEach(loadModules);

  describe('access', () => {
    it('is guarded by the user guard, then the AI rate limit', () => {
      const {
        GUARD_USER,
      } = require('../../../packages/server/account/auth.guard');
      const guards = routeInspector(textGenerationRouter).guardsOf(
        'post',
        '/corrections'
      );
      expect(guards[0]).toBe(GUARD_USER);
      expect(guards.map((guard) => guard.name)).toContain(
        'aiRateLimitMiddleware'
      );
    });

    it('answers 404 for a mailing the user cannot see, without invoking anything', async () => {
      mailingService.findOneForUser.mockRejectedValue(
        createError(404, 'MAILING_NOT_FOUND')
      );
      const res = await post();
      expect(res.status).toBe(404);
      expect(invoke).not.toHaveBeenCalled();
    });

    it('answers 403 for a mailing the user cannot edit, without invoking anything', async () => {
      mailingService.assertUserCanEditMailing.mockRejectedValue(
        createError(403, 'FORBIDDEN_MAILING_EDIT')
      );
      const res = await post();
      expect(res.status).toBe(403);
      expect(invoke).not.toHaveBeenCalled();
    });

    it.each([
      ['no field', { ...body, fields: [] }],
      [
        'a field without its path',
        { ...body, fields: [{ role: 'text', text: 'Texte' }] },
      ],
      ['no target', { mailingId: MAILING_ID, fields: FIELDS }],
    ])(
      'answers 400 for %s, without invoking anything',
      async (_label, payload) => {
        const res = await post(payload);
        expect(res.status).toBe(400);
        expect(invoke).not.toHaveBeenCalled();
      }
    );
  });

  describe('the invocation', () => {
    it('reads the expertise of scope correction', async () => {
      invoke.mockResolvedValue(corrections());
      await post();
      expect(findApplicable).toHaveBeenCalledWith({
        scope: 'correction',
        categories: ['redaction'],
      });
    });

    it('invokes the correction skill with the visible text of each field, on the text generation engine', async () => {
      invoke.mockResolvedValue(corrections());
      await post();
      const call = invoke.mock.calls[0][0];
      expect(call).toEqual(
        expect.objectContaining({
          skillId: 'redaction.correction',
          featureType: 'text_generation',
          invocationSource: 'text-generation.correction',
          groupId: 'g1',
          userId: 'u1',
          expertiseConsumed: [],
        })
      );
      expect(call.input).toEqual({ fields: FIELDS, expertise: [] });
    });
  });

  describe('the corrections', () => {
    it('returns the corrections the code can place', async () => {
      invoke.mockResolvedValue(
        corrections(
          fix(
            'titleText',
            'soldes commence',
            'soldes commencent',
            'Accord du verbe'
          ),
          fix('longText', 'la colection', 'la collection')
        )
      );
      const res = await post();
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        corrections: [
          fix(
            'titleText',
            'soldes commence',
            'soldes commencent',
            'Accord du verbe'
          ),
          fix('longText', 'la colection', 'la collection'),
        ],
        dropped: 0,
      });
    });

    it.each([
      [
        'not in the text',
        fix('longText', 'la colection de lin', 'la collection de lin'),
      ],
      ['found twice', fix('longText', 'l', 'L')],
      ['touching a merge tag', fix('longText', '{{prenom}},', '{{prenom}} ,')],
      ['changing nothing', fix('titleText', 'demain', 'demain')],
      [
        'on a field that was not sent',
        fix('buttonText', 'Je choisi', 'Je choisis'),
      ],
    ])('drops and counts a correction %s', async (_label, dropped) => {
      invoke.mockResolvedValue(
        corrections(fix('longText', 'la colection', 'la collection'), dropped)
      );
      const res = await post();
      expect(res.body.corrections).toEqual([
        fix('longText', 'la colection', 'la collection'),
      ]);
      expect(res.body.dropped).toBe(1);
    });

    it('answers no correction for a text without mistake', async () => {
      invoke.mockResolvedValue(corrections());
      const res = await post();
      expect(res.body).toEqual({ corrections: [], dropped: 0 });
    });
  });

  describe('errors', () => {
    it('answers 403 TEXT_GENERATION_DISABLED when the engine is off', async () => {
      invoke.mockRejectedValue(engineOff('FEATURE_INACTIVE'));
      const res = await post();
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('TEXT_GENERATION_DISABLED');
    });

    it('answers 503 TEXT_GENERATION_UNAVAILABLE when the skill is missing', async () => {
      invoke.mockRejectedValue(skillMissing());
      const res = await post();
      expect(res.status).toBe(503);
      expect(res.body.message).toBe('TEXT_GENERATION_UNAVAILABLE');
    });
  });
});
