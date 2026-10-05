'use strict';

/**
 * Acceptance tests of text generation (epic #1163), at its HTTP seam.
 *
 * The module boundaries are mocked — skill invocation, expertise lookup, mailing
 * access, the email type of a mailing — so these tests pin what a caller sees:
 * status codes, the proposals and their facts, the rules that drop a proposal,
 * and what each invocation is given. How the prompt is assembled is the skill's
 * business, and is checked with golden runs in the playground, not here.
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

const CONTENT = [
  { role: 'title', text: 'Les soldes commencent' },
  { role: 'text', text: 'Bonjour {{prenom}}, -30 % sur la collection lin.' },
  { role: 'button', text: 'Je choisis ma tenue' },
];

const EXPERTISE = [
  {
    expertiseId: 'redaction.principes-email',
    title: 'Principes de rédaction email',
    body: '## [lecteur-d-abord] Le lecteur d’abord',
    examplesGood: ['Réponse sous 48h.'],
    examplesBad: ['Découvrez vite nos nouveautés'],
    isTransversal: true,
    versionMajor: 1,
    versionMinor: 2,
  },
  {
    expertiseId: 'redaction.doctrine-objet',
    title: 'Doctrine de l’objet d’email',
    body: '## [longueur] Longueur',
    examplesGood: [],
    examplesBad: [],
    isTransversal: false,
    versionMajor: 2,
    versionMinor: 0,
  },
];

// What the skill receives: the expertise as a skill reads it, without the
// bookkeeping the repository adds.
const EXPERTISE_INPUT = [
  {
    expertiseId: 'redaction.principes-email',
    title: 'Principes de rédaction email',
    body: '## [lecteur-d-abord] Le lecteur d’abord',
    examplesGood: ['Réponse sous 48h.'],
    examplesBad: ['Découvrez vite nos nouveautés'],
  },
  {
    expertiseId: 'redaction.doctrine-objet',
    title: 'Doctrine de l’objet d’email',
    body: '## [longueur] Longueur',
    examplesGood: [],
    examplesBad: [],
  },
];

const EXPERTISE_CONSUMED = [
  {
    expertiseId: 'redaction.principes-email',
    versionMajor: 1,
    versionMinor: 2,
  },
  { expertiseId: 'redaction.doctrine-objet', versionMajor: 2, versionMinor: 0 },
];

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

function proposals(...texts) {
  return {
    output: {
      proposals: texts.map((text, index) => ({
        text,
        angle: `Angle ${index}`,
      })),
    },
    invocationId: 'inv1',
  };
}

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
    'Skill "redaction.objet" not found or not ACTIVE'
  );
  err.invocationStatus = 'CONFIG_ERROR';
  return err;
}
function failedInvocation(status, invocationStatus) {
  const err = createError(status, 'Skill invocation failed');
  err.invocationStatus = invocationStatus;
  err.invocationId = 'inv1';
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
  findApplicable.mockResolvedValue(EXPERTISE);
}

describe('text generation: POST /api/text-generation/subject', () => {
  beforeEach(loadModules);

  const body = {
    mailingId: MAILING_ID,
    content: CONTENT,
    currentSubject: 'Nos soldes',
    brief: 'Insister sur la livraison',
    avoid: ['Soldes : -30 % sur le lin'],
  };

  describe('access', () => {
    it('refuses a request without a user', async () => {
      const res = await request(makeApp({ user: null }))
        .post('/api/text-generation/subject')
        .send(body);
      expect(res.status).toBe(401);
      expect(invoke).not.toHaveBeenCalled();
    });

    it('is guarded by the user guard, then the AI rate limit', () => {
      const {
        GUARD_USER,
      } = require('../../../packages/server/account/auth.guard');
      const guards = routeInspector(textGenerationRouter).guardsOf(
        'post',
        '/subject'
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
      const res = await request(makeApp())
        .post('/api/text-generation/subject')
        .send(body);
      expect(res.status).toBe(404);
      expect(invoke).not.toHaveBeenCalled();
    });

    it('answers 403 for a mailing the user cannot edit, without invoking anything', async () => {
      mailingService.assertUserCanEditMailing.mockRejectedValue(
        createError(403, 'FORBIDDEN_MAILING_EDIT')
      );
      const res = await request(makeApp())
        .post('/api/text-generation/subject')
        .send(body);
      expect(res.status).toBe(403);
      expect(invoke).not.toHaveBeenCalled();
    });

    it('checks access on the mailing named in the body, for the requesting user', async () => {
      invoke.mockResolvedValue(proposals('Lin : -30 % et livraison offerte'));
      await request(makeApp()).post('/api/text-generation/subject').send(body);
      expect(mailingService.findOneForUser).toHaveBeenCalledWith(
        MAILING_ID,
        USER
      );
    });
  });

  describe('request validation', () => {
    it.each([
      ['no content', { mailingId: MAILING_ID }],
      ['empty content', { mailingId: MAILING_ID, content: [] }],
      [
        'content without text',
        { mailingId: MAILING_ID, content: [{ role: 'text', text: '  ' }] },
      ],
      [
        'an unknown role',
        { mailingId: MAILING_ID, content: [{ role: 'footer', text: 'x' }] },
      ],
      ['no mailing', { content: CONTENT }],
    ])(
      'answers 400 for %s, without invoking anything',
      async (_label, payload) => {
        const res = await request(makeApp())
          .post('/api/text-generation/subject')
          .send(payload);
        expect(res.status).toBe(400);
        expect(invoke).not.toHaveBeenCalled();
      }
    );
  });

  describe('the invocation', () => {
    beforeEach(() => {
      invoke.mockResolvedValue(proposals('Lin : -30 % et livraison offerte'));
    });

    it('asks for the subject expertise of the writing and deliverability categories, for the email type', async () => {
      await request(makeApp()).post('/api/text-generation/subject').send(body);
      expect(findApplicable).toHaveBeenCalledWith({
        scope: 'subject',
        categories: ['redaction', 'deliverability'],
        emailType: 'promotional',
      });
    });

    it('asks without an email type when the mailing has none', async () => {
      mailingMetadataService.findCanonicalEmailType.mockResolvedValue(null);
      await request(makeApp()).post('/api/text-generation/subject').send(body);
      expect(findApplicable).toHaveBeenCalledWith({
        scope: 'subject',
        categories: ['redaction', 'deliverability'],
      });
      expect(invoke.mock.calls[0][0].input).not.toHaveProperty('emailType');
    });

    it('invokes the subject skill on the text generation engine, for the user and their group', async () => {
      await request(makeApp()).post('/api/text-generation/subject').send(body);
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          skillId: 'redaction.objet',
          featureType: 'text_generation',
          invocationSource: 'text-generation.subject',
          groupId: 'g1',
          userId: 'u1',
        })
      );
    });

    it('gives the skill the content, the email type, the request and the expertise, and logs the versions read', async () => {
      await request(makeApp()).post('/api/text-generation/subject').send(body);
      const call = invoke.mock.calls[0][0];
      expect(call.input).toEqual({
        content: CONTENT,
        emailType: 'promotional',
        currentSubject: 'Nos soldes',
        brief: 'Insister sur la livraison',
        avoid: ['Soldes : -30 % sur le lin'],
        expertise: EXPERTISE_INPUT,
      });
      expect(call.expertiseConsumed).toEqual(EXPERTISE_CONSUMED);
    });

    it('leaves out the optional fields the request does not carry', async () => {
      await request(makeApp())
        .post('/api/text-generation/subject')
        .send({ mailingId: MAILING_ID, content: CONTENT });
      expect(invoke.mock.calls[0][0].input).toEqual({
        content: CONTENT,
        emailType: 'promotional',
        expertise: EXPERTISE_INPUT,
      });
    });
  });

  describe('the proposals', () => {
    it('returns each proposal with its angle and the facts measured on it', async () => {
      invoke.mockResolvedValue({
        output: {
          proposals: [
            {
              text: 'Webinar : 3 astuces pour gagner du temps',
              angle: 'Chiffre concret',
            },
            { text: 'Bonjour {{prenom}}', angle: 'Personnalisation' },
          ],
        },
      });
      const res = await request(makeApp())
        .post('/api/text-generation/subject')
        .send(body);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        proposals: [
          {
            text: 'Webinar : 3 astuces pour gagner du temps',
            angle: 'Chiffre concret',
            facts: {
              length: 40,
              mobilePreview: 'Webinar : 3 astuces pour gagner du ',
              truncatedOnMobile: true,
            },
          },
          {
            // The variable is in the content, so it is kept, and its value is
            // only known at send time: it does not count.
            text: 'Bonjour {{prenom}}',
            angle: 'Personnalisation',
            facts: {
              length: 7,
              mobilePreview: 'Bonjour {{prenom}}',
              truncatedOnMobile: false,
            },
          },
        ],
        dropped: 0,
      });
    });

    it('drops a proposal with a variable that is not in the content, and says how many were dropped', async () => {
      invoke.mockResolvedValue(
        proposals(
          'Lin : -30 % avec {{code_promo}}',
          'Lin : -30 % et livraison offerte'
        )
      );
      const res = await request(makeApp())
        .post('/api/text-generation/subject')
        .send(body);
      expect(res.body.proposals.map((p) => p.text)).toEqual([
        'Lin : -30 % et livraison offerte',
      ]);
      expect(res.body.dropped).toBe(1);
    });

    it.each([
      ['an emoji at its start', '🌿 Lin : -30 % cette semaine'],
      ['more than one emoji', 'Lin : -30 % cette semaine 🌿☀️'],
      ['a fake reply prefix', 'RE: votre collection lin'],
      ['a fake forward prefix', 'Fwd : -30 % sur le lin'],
      ['a variable written another way', 'Lin : -30 % pour %%PRENOM%%'],
    ])('drops a proposal with %s', async (_label, text) => {
      invoke.mockResolvedValue(
        proposals(text, 'Lin : -30 % et livraison offerte')
      );
      const res = await request(makeApp())
        .post('/api/text-generation/subject')
        .send(body);
      expect(res.body.proposals.map((p) => p.text)).toEqual([
        'Lin : -30 % et livraison offerte',
      ]);
      expect(res.body.dropped).toBe(1);
    });

    it('keeps a proposal ending with one emoji', async () => {
      invoke.mockResolvedValue(proposals('Lin : -30 % cette semaine 🌿'));
      const res = await request(makeApp())
        .post('/api/text-generation/subject')
        .send(body);
      expect(res.body.dropped).toBe(0);
      expect(res.body.proposals).toHaveLength(1);
    });

    it('never drops a proposal for its length', async () => {
      const long =
        'Collection lin : -30 % sur toutes les tenues, livraison offerte jusqu’à dimanche';
      invoke.mockResolvedValue(proposals(long));
      const res = await request(makeApp())
        .post('/api/text-generation/subject')
        .send(body);
      expect(res.body.dropped).toBe(0);
      expect(res.body.proposals[0].text).toBe(long);
      expect(res.body.proposals[0].facts.truncatedOnMobile).toBe(true);
    });

    it('answers with no proposal and the count when all of them are dropped', async () => {
      invoke.mockResolvedValue(
        proposals('RE: lin', '🌿 Lin', 'Lin {{inconnu}}')
      );
      const res = await request(makeApp())
        .post('/api/text-generation/subject')
        .send(body);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ proposals: [], dropped: 3 });
    });
  });

  describe('the rules, beyond the obvious', () => {
    const keepsOnly = async (texts, expected, payload = body) => {
      invoke.mockResolvedValue(proposals(...texts));
      const res = await request(makeApp())
        .post('/api/text-generation/subject')
        .send(payload);
      expect(res.body.proposals.map((p) => p.text)).toEqual(expected);
      expect(res.body.dropped).toBe(texts.length - expected.length);
    };

    it('keeps a variable the current subject uses, though the content does not', async () => {
      await keepsOnly(
        ['*|FNAME|*, -30 % sur le lin'],
        ['*|FNAME|*, -30 % sur le lin'],
        {
          ...body,
          currentSubject: '*|FNAME|*, nos soldes',
        }
      );
    });

    it('keeps a known variable written with other spaces or case', async () => {
      await keepsOnly(
        ['{{ PRENOM }}, -30 % sur le lin'],
        ['{{ PRENOM }}, -30 % sur le lin']
      );
    });

    it.each([
      [
        'a variable in a form no ESP reads',
        'Bonjour {prenom}, -30 % sur le lin',
      ],
      ['another invented form', 'Bonjour %prenom%, -30 % sur le lin'],
      ['a flag first', '🇫🇷 Lin : -30 % cette semaine'],
      ['a full-width colon reply prefix', 'RE： votre collection lin'],
      ['a counted reply prefix', 'Re[2]: votre collection lin'],
    ])('drops a proposal with %s', async (_label, text) => {
      await keepsOnly(
        [text, 'Lin : -30 % et livraison offerte'],
        ['Lin : -30 % et livraison offerte']
      );
    });

    it('keeps one emoji made of several code points, at the end', async () => {
      await keepsOnly(
        ['Lin : -30 % pour toute la famille 👨‍👩‍👧'],
        ['Lin : -30 % pour toute la famille 👨‍👩‍👧']
      );
    });

    it('keeps a bracketed label, which is not a variable', async () => {
      await keepsOnly(
        ['[IMPORTANT] Lin : -30 % jusqu’à dimanche'],
        ['[IMPORTANT] Lin : -30 % jusqu’à dimanche']
      );
    });

    it('drops a proposal the email settings could not save', async () => {
      await keepsOnly(['L'.repeat(256), 'Lin : -30 %'], ['Lin : -30 %']);
    });

    it('drops a duplicate and a proposal the user already saw', async () => {
      await keepsOnly(
        ['Soldes : -30 % sur le lin', 'Lin : -30 %', 'Lin : -30 %'],
        ['Lin : -30 %']
      );
    });
  });

  describe('the request limits', () => {
    it.each([
      ['more than 30 proposals to avoid', { avoid: Array(31).fill('x') }],
      [
        'a proposal to avoid longer than 300 characters',
        { avoid: ['x'.repeat(301)] },
      ],
      ['an instruction longer than 500 characters', { brief: 'x'.repeat(501) }],
    ])('answers 400 for %s', async (_label, extra) => {
      const res = await request(makeApp())
        .post('/api/text-generation/subject')
        .send({ ...body, ...extra });
      expect(res.status).toBe(400);
      expect(invoke).not.toHaveBeenCalled();
    });
  });

  describe('for a super admin, who has no group', () => {
    const admin = { id: 'admin', isAdmin: true };

    it('serves the request with the engine of the mailing company', async () => {
      mailingService.findOneForUser.mockResolvedValue({
        id: MAILING_ID,
        _company: 'g-mailing',
      });
      invoke.mockResolvedValue(proposals('Lin : -30 %'));
      await request(makeApp({ user: admin }))
        .post('/api/text-generation/subject')
        .send(body);
      expect(invoke.mock.calls[0][0].groupId).toBe('g-mailing');
    });

    it('falls back on the company of the template for a mailing without one', async () => {
      const {
        Templates,
      } = require('../../../packages/server/common/models.common.js');
      Templates.findById.mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve({ _company: 'g-template' }),
        }),
      });
      mailingService.findOneForUser.mockResolvedValue({
        id: MAILING_ID,
        _wireframe: 't1',
      });
      invoke.mockResolvedValue(proposals('Lin : -30 %'));
      await request(makeApp({ user: admin }))
        .post('/api/text-generation/subject')
        .send(body);
      expect(Templates.findById).toHaveBeenCalledWith('t1');
      expect(invoke.mock.calls[0][0].groupId).toBe('g-template');
    });
  });

  describe('when generation is not possible', () => {
    it.each([
      'FEATURE_INACTIVE',
      'NO_CONFIG',
      'NO_INTEGRATION',
      'INTEGRATION_INACTIVE',
    ])(
      'answers 403 TEXT_GENERATION_DISABLED when the engine is off (%s)',
      async (reason) => {
        invoke.mockRejectedValue(engineOff(reason));
        const res = await request(makeApp())
          .post('/api/text-generation/subject')
          .send(body);
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('TEXT_GENERATION_DISABLED');
      }
    );

    it('answers 503 TEXT_GENERATION_UNAVAILABLE when the skill is missing in the environment', async () => {
      invoke.mockRejectedValue(skillMissing());
      const res = await request(makeApp())
        .post('/api/text-generation/subject')
        .send(body);
      expect(res.status).toBe(503);
      expect(res.body.message).toBe('TEXT_GENERATION_UNAVAILABLE');
    });

    it('answers 503 when the active skill refuses the input this feature builds', async () => {
      const err = failedInvocation(400, 'VALIDATION_ERROR');
      err.skillError = {
        code: 'INPUT_VALIDATION',
        message: 'content: Required',
      };
      invoke.mockRejectedValue(err);
      const res = await request(makeApp())
        .post('/api/text-generation/subject')
        .send(body);
      expect(res.status).toBe(503);
      expect(res.body.message).toBe('TEXT_GENERATION_UNAVAILABLE');
    });

    it.each([
      ['the provider fails', 502, 'PROVIDER_ERROR'],
      ['the provider times out', 502, 'TIMEOUT'],
      // A malformed model answer is not the caller's mistake.
      ['the model answers out of contract', 400, 'VALIDATION_ERROR'],
    ])(
      'answers 502 when %s, without the provider detail',
      async (_label, status, invocationStatus) => {
        invoke.mockRejectedValue(failedInvocation(status, invocationStatus));
        const res = await request(makeApp())
          .post('/api/text-generation/subject')
          .send(body);
        expect(res.status).toBe(502);
        expect(res.body.message).toBe('TEXT_GENERATION_FAILED');
      }
    );
  });
});

// Turned on by #1167 (generate and apply a preheader built from the picked subject)
describe.skip('text generation: POST /api/text-generation/preheader', () => {
  beforeEach(loadModules);

  const body = {
    mailingId: MAILING_ID,
    content: CONTENT,
    subject: 'Lin : -30 % et livraison offerte',
    currentPreheader: 'Voir la version en ligne',
    avoid: ['Jusqu’à dimanche'],
  };

  it('is guarded by the user guard, then the AI rate limit', () => {
    const {
      GUARD_USER,
    } = require('../../../packages/server/account/auth.guard');
    const guards = routeInspector(textGenerationRouter).guardsOf(
      'post',
      '/preheader'
    );
    expect(guards[0]).toBe(GUARD_USER);
    expect(guards.map((guard) => guard.name)).toContain(
      'aiRateLimitMiddleware'
    );
  });

  it('answers 403 for a mailing the user cannot edit, without invoking anything', async () => {
    mailingService.assertUserCanEditMailing.mockRejectedValue(
      createError(403, 'FORBIDDEN_MAILING_EDIT')
    );
    const res = await request(makeApp())
      .post('/api/text-generation/preheader')
      .send(body);
    expect(res.status).toBe(403);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('answers 400 without the picked subject, without invoking anything', async () => {
    const res = await request(makeApp())
      .post('/api/text-generation/preheader')
      .send({ mailingId: MAILING_ID, content: CONTENT });
    expect(res.status).toBe(400);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('asks for the preheader expertise of the writing and deliverability categories', async () => {
    invoke.mockResolvedValue(
      proposals('Jusqu’au dimanche 12 mai inclus, sur tout le rayon lin')
    );
    await request(makeApp()).post('/api/text-generation/preheader').send(body);
    expect(findApplicable).toHaveBeenCalledWith({
      scope: 'preheader',
      categories: ['redaction', 'deliverability'],
      emailType: 'promotional',
    });
  });

  it('invokes the preheader skill with the picked subject, on the text generation engine', async () => {
    invoke.mockResolvedValue(
      proposals('Jusqu’au dimanche 12 mai inclus, sur tout le rayon lin')
    );
    await request(makeApp()).post('/api/text-generation/preheader').send(body);
    const call = invoke.mock.calls[0][0];
    expect(call).toEqual(
      expect.objectContaining({
        skillId: 'redaction.pre-header',
        featureType: 'text_generation',
        invocationSource: 'text-generation.preheader',
        groupId: 'g1',
        userId: 'u1',
        expertiseConsumed: EXPERTISE_CONSUMED,
      })
    );
    expect(call.input).toEqual({
      content: CONTENT,
      emailType: 'promotional',
      subject: 'Lin : -30 % et livraison offerte',
      currentPreheader: 'Voir la version en ligne',
      avoid: ['Jusqu’à dimanche'],
      expertise: EXPERTISE_INPUT,
    });
  });

  it('returns each proposal with its length and the short and long signals', async () => {
    invoke.mockResolvedValue({
      output: {
        proposals: [
          { text: 'Mardi 15 mars à 11h, en ligne', angle: 'Date' },
          {
            text: 'Jusqu’au dimanche 12 mai inclus, sur tout le rayon hiver',
            angle: 'Condition',
          },
        ],
      },
    });
    const res = await request(makeApp())
      .post('/api/text-generation/preheader')
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      proposals: [
        {
          text: 'Mardi 15 mars à 11h, en ligne',
          angle: 'Date',
          facts: { length: 29, tooShort: true, tooLong: false },
        },
        {
          text: 'Jusqu’au dimanche 12 mai inclus, sur tout le rayon hiver',
          angle: 'Condition',
          facts: { length: 56, tooShort: false, tooLong: false },
        },
      ],
      dropped: 0,
    });
  });

  it.each([
    ['any emoji', 'Jusqu’au dimanche inclus, sur tout le rayon lin 🌿'],
    [
      'a variable that is not in the content',
      'Votre code {{code_promo}} valable jusqu’à dimanche',
    ],
    ['a fake reply prefix', 'RE: jusqu’à dimanche inclus'],
  ])('drops a proposal with %s', async (_label, text) => {
    invoke.mockResolvedValue(
      proposals(text, 'Jusqu’au dimanche 12 mai inclus, sur tout le rayon lin')
    );
    const res = await request(makeApp())
      .post('/api/text-generation/preheader')
      .send(body);
    expect(res.body.proposals.map((p) => p.text)).toEqual([
      'Jusqu’au dimanche 12 mai inclus, sur tout le rayon lin',
    ]);
    expect(res.body.dropped).toBe(1);
  });

  it('answers 403 TEXT_GENERATION_DISABLED when the engine is off', async () => {
    invoke.mockRejectedValue(engineOff('FEATURE_INACTIVE'));
    const res = await request(makeApp())
      .post('/api/text-generation/preheader')
      .send(body);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('TEXT_GENERATION_DISABLED');
  });

  it('answers 503 TEXT_GENERATION_UNAVAILABLE when the skill is missing', async () => {
    invoke.mockRejectedValue(skillMissing());
    const res = await request(makeApp())
      .post('/api/text-generation/preheader')
      .send(body);
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('TEXT_GENERATION_UNAVAILABLE');
  });
});
