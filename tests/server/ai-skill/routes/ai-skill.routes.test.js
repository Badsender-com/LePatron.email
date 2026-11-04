'use strict';

/**
 * Lightweight HTTP-level tests on the ai-skill router. Services are mocked
 * — these tests focus on routing, guard wiring, and request/response shape.
 */

// ── Mock service layer ─────────────────────────────────────────────────────
jest.mock(
  '../../../../packages/server/ai-skill/services/skill.service',
  () => ({
    listSkills: jest.fn(),
    getSkill: jest.fn(),
    createSkill: jest.fn(),
    updateSkill: jest.fn(),
    createMinorVersion: jest.fn(),
    createMajorVersion: jest.fn(),
    updateVersion: jest.fn(),
    deleteVersion: jest.fn(),
    activateVersion: jest.fn(),
    archiveSkill: jest.fn(),
    consumedExpertiseWarnings: jest.fn(async () => []),
  })
);
jest.mock(
  '../../../../packages/server/ai-skill/services/expertise.service',
  () => ({
    listExpertise: jest.fn(),
    getExpertise: jest.fn(),
    createExpertise: jest.fn(),
    updateExpertise: jest.fn(),
    createMinorVersion: jest.fn(),
    createMajorVersion: jest.fn(),
    updateVersion: jest.fn(),
    deleteVersion: jest.fn(),
    activateVersion: jest.fn(),
    archiveExpertise: jest.fn(),
  })
);
jest.mock(
  '../../../../packages/server/ai-skill/services/invocation-log.service',
  () => ({ listInvocations: jest.fn(), getInvocation: jest.fn() })
);

// A feature, as a skill manifest declares it: the lists and the detail pages
// say what it uses (ADR 0019).
const SUBJECT_FEATURE = {
  featureType: 'subject_generation',
  description: 'Subject line generation',
  usedSkills: ['redaction.subject-ideas'],
  usedExpertise: [],
  expertiseFilters: [{ scope: ['subject'], categories: ['redaction'] }],
};
const USED_BY_SUBJECT = [
  { featureType: 'subject_generation', description: 'Subject line generation' },
];
jest.mock(
  '../../../../packages/server/ai-skill/services/manifest-registry',
  () => ({
    ...jest.requireActual(
      '../../../../packages/server/ai-skill/services/manifest-registry'
    ),
    listManifests: () => [SUBJECT_FEATURE],
  })
);

// Publishing reads the store for the features that use a version: here, no
// feature uses any, so it comes down to the activation of the mocked service.
// The guard itself is tested on its own (skills-publication.service.test.js,
// routes/publication.routes.test.js).
jest.mock(
  '../../../../packages/server/ai-skill/services/skills-publication.service',
  () => {
    const actual = jest.requireActual(
      '../../../../packages/server/ai-skill/services/skills-publication.service'
    );
    return {
      ...actual,
      // As the service answers: the item, and a skill's opening warnings.
      publishVersion: async ({ kind, id, version, payload }, user) => {
        const published = await require(`../../../../packages/server/ai-skill/services/${kind}.service`).activateVersion(
          id,
          version,
          payload,
          user.id
        );
        return kind === 'skill'
          ? { doc: published.skill, warnings: published.warnings || [] }
          : { doc: published, warnings: [] };
      },
    };
  }
);

// Stub the auth guard, on the real rule, so the test picks the user.
jest.mock('../../../../packages/server/account/auth.guard', () => ({
  GUARD_ADMIN: (req, res, next) => {
    // The real rule: the platform capability, read from the role or the
    // bootstrap account's identity.
    const permissions = require('../../../../packages/server/account/permissions.js');
    const {
      CAPABILITIES,
    } = require('../../../../packages/shared/access/roles.js');
    if (permissions.can(req.user, CAPABILITIES.PLATFORM_MANAGE)) return next();
    return res.status(401).json({ message: 'Unauthorized' });
  },
}));

const express = require('express');
const request = require('../../../helpers/local-request.js');

const skillService = require('../../../../packages/server/ai-skill/services/skill.service');
const expertiseService = require('../../../../packages/server/ai-skill/services/expertise.service');
const invocationLog = require('../../../../packages/server/ai-skill/services/invocation-log.service');

const {
  skillsRouter,
  expertiseRouter,
  invocationsRouter,
} = require('../../../../packages/server/ai-skill/ai-skill.routes');

function makeApp({ asAdmin = true } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = asAdmin
      ? { id: 'admin', role: 'super_admin' }
      : { id: 'someone', role: 'regular_user' };
    next();
  });
  app.use('/api/ai-skills', skillsRouter);
  app.use('/api/ai-expertise', expertiseRouter);
  app.use('/api/ai-invocations', invocationsRouter);
  // Centralized error handler so http-errors propagates as JSON.
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
      message: err.message,
      code: err.skillError && err.skillError.code,
    });
  });
  return app;
}

beforeEach(() => jest.clearAllMocks());

describe('ai-skill HTTP routes', () => {
  it('rejects non-admin users with 401 on every route', async () => {
    const app = makeApp({ asAdmin: false });
    const res = await request(app).get('/api/ai-skills');
    expect(res.status).toBe(401);
  });

  it('GET /api/ai-skills returns the list from the service', async () => {
    skillService.listSkills.mockResolvedValue({
      items: [{ skillId: 'a' }],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    const res = await request(makeApp()).get('/api/ai-skills');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([{ skillId: 'a', usedBy: [] }]);
  });

  describe('used by a feature', () => {
    const SUBJECT_LINES = {
      expertiseId: 'redaction.subject-line',
      category: 'redaction',
      scope: ['subject'],
    };
    const SPAM_WORDS = {
      expertiseId: 'deliverability.spam-words',
      category: 'deliverability',
      scope: [],
      isTransversal: true,
    };

    it('is said of each skill of the list', async () => {
      skillService.listSkills.mockResolvedValue({
        items: [
          { skillId: 'redaction.subject-ideas' },
          { skillId: 'qc.other' },
        ],
        total: 2,
      });
      const res = await request(makeApp()).get('/api/ai-skills');
      expect(res.body.items.map((item) => item.usedBy)).toEqual([
        USED_BY_SUBJECT,
        [],
      ]);
      expect(res.body.total).toBe(2);
    });

    it('is said of a skill on its page', async () => {
      skillService.getSkill.mockResolvedValue({
        skillId: 'redaction.subject-ideas',
        toJSON: () => ({
          skillId: 'redaction.subject-ideas',
          title: 'Ideas',
          versions: [],
        }),
      });
      const res = await request(makeApp()).get(
        '/api/ai-skills/redaction.subject-ideas'
      );
      expect(res.body).toEqual({
        skillId: 'redaction.subject-ideas',
        title: 'Ideas',
        versions: [],
        usedBy: USED_BY_SUBJECT,
      });
    });

    it('is said of each expertise of the list, from the declared filters', async () => {
      expertiseService.listExpertise.mockResolvedValue({
        items: [SUBJECT_LINES, SPAM_WORDS],
        total: 2,
      });
      const res = await request(makeApp()).get('/api/ai-expertise');
      expect(res.body.items.map((item) => item.usedBy)).toEqual([
        USED_BY_SUBJECT,
        [],
      ]);
    });

    it('is said of an expertise on its page, and again once it is changed', async () => {
      expertiseService.getExpertise.mockResolvedValue(SUBJECT_LINES);
      const shown = await request(makeApp()).get(
        '/api/ai-expertise/redaction.subject-line'
      );
      expect(shown.body.usedBy).toEqual(USED_BY_SUBJECT);

      expertiseService.updateExpertise.mockResolvedValue({
        ...SUBJECT_LINES,
        scope: ['body'],
      });
      const changed = await request(makeApp())
        .patch('/api/ai-expertise/redaction.subject-line')
        .send({ scope: ['body'] });
      expect(changed.body.usedBy).toEqual([]);
    });
  });

  it('GET /api/ai-skills/schemas exposes the registered zod schemas', async () => {
    const res = await request(makeApp()).get('/api/ai-skills/schemas');
    expect(res.status).toBe(200);
    expect(res.body.schemas).toEqual(
      expect.arrayContaining(['genericTextInput', 'genericTextOutput'])
    );
  });

  it('GET /api/ai-skills/schemas/:schemaId/descriptor describes the schema', async () => {
    const res = await request(makeApp()).get(
      '/api/ai-skills/schemas/genericTextInput/descriptor'
    );
    expect(res.status).toBe(200);
    expect(res.body.hasExpertiseField).toBe(true);
    expect(res.body.fields).toEqual([
      { name: 'prompt', type: 'string', required: true, multiline: true },
      { name: 'context', type: 'string', required: false, multiline: true },
    ]);
  });

  it('GET /api/ai-skills/schemas/:schemaId/descriptor returns 404 for unknown schema', async () => {
    const res = await request(makeApp()).get(
      '/api/ai-skills/schemas/nope/descriptor'
    );
    expect(res.status).toBe(404);
  });

  it('full lifecycle: create → major version → activate → minor version → activate → archive', async () => {
    skillService.createSkill.mockResolvedValue({
      skillId: 'a',
      status: 'DRAFT',
    });
    skillService.createMajorVersion.mockResolvedValue({
      skillId: 'a',
      versions: [{ versionMajor: 1, versionMinor: 0, status: 'DRAFT' }],
    });
    skillService.activateVersion.mockResolvedValue({
      skill: {
        skillId: 'a',
        status: 'ACTIVE',
        activeVersion: { major: 1, minor: 0 },
      },
      warnings: [],
    });
    skillService.createMinorVersion.mockResolvedValue({
      skillId: 'a',
      versions: [
        { versionMajor: 1, versionMinor: 0, status: 'ACTIVE' },
        { versionMajor: 1, versionMinor: 1, status: 'DRAFT' },
      ],
    });
    skillService.archiveSkill.mockResolvedValue({
      skillId: 'a',
      status: 'ARCHIVED',
    });

    const app = makeApp();
    const r1 = await request(app).post('/api/ai-skills').send({
      skillId: 'a',
      title: 't',
      category: 'redaction',
      inputSchemaId: 'genericTextInput',
      outputSchemaId: 'genericTextOutput',
    });
    expect(r1.status).toBe(201);

    const r2 = await request(app).post('/api/ai-skills/a/versions/major');
    expect(r2.status).toBe(201);

    const r3 = await request(app)
      .post('/api/ai-skills/a/versions/1.0/activate')
      .send({ changelog: 'c', releaseNotes: 'r' });
    expect(r3.status).toBe(200);
    expect(r3.body.status).toBe('ACTIVE');

    const r4 = await request(app).post('/api/ai-skills/a/versions/minor');
    expect(r4.status).toBe(201);

    const r5 = await request(app).post('/api/ai-skills/a/archive');
    expect(r5.status).toBe(200);
    expect(r5.body.status).toBe('ARCHIVED');
  });

  // A task skill's version has neither template nor schema (ADR 0013): the
  // template warnings of a feature skill do not apply to it.
  it.each([
    ['feature', 'warns', true],
    ['task', 'does not warn', false],
  ])(
    'PATCH a version of a %s skill %s about its template',
    async (nature, _label, warned) => {
      skillService.updateVersion.mockResolvedValue({
        skillId: 'a',
        versions: [
          {
            versionMajor: 1,
            versionMinor: 1,
            status: 'DRAFT',
            nature,
            inputSchemaId: 'genericTextInput',
            inputTemplate: '',
          },
        ],
      });

      const res = await request(makeApp())
        .patch('/api/ai-skills/a/versions/1.1')
        .send({ nature });

      expect(res.status).toBe(200);
      expect(res.body.warnings.length > 0).toBe(warned);
    }
  );

  // Production writes a feature skill before its code ships (ADR 0019): the
  // draft naming a schema this code lacks says so, for its badge, and its
  // save warns that its publication waits for the code.
  const draftNaming = (inputSchemaId) => ({
    skillId: 'a',
    versions: [
      {
        versionMajor: 1,
        versionMinor: 0,
        status: 'ACTIVE',
        inputSchemaId: 'genericTextInput',
        outputSchemaId: 'genericTextOutput',
      },
      {
        versionMajor: 1,
        versionMinor: 1,
        status: 'DRAFT',
        nature: 'feature',
        inputSchemaId,
        outputSchemaId: 'genericTextOutput',
        inputTemplate: '',
      },
    ],
  });

  it('GET a skill says which schema of a version the code lacks', async () => {
    skillService.getSkill.mockResolvedValue(draftNaming('notShippedYet'));

    const res = await request(makeApp()).get('/api/ai-skills/a');

    expect(res.status).toBe(200);
    expect(res.body.versions[0]).not.toHaveProperty('missingSchemaIds');
    expect(res.body.versions[1].missingSchemaIds).toEqual(['notShippedYet']);
  });

  it('PATCH a draft naming a schema the code lacks warns of it', async () => {
    skillService.updateVersion.mockResolvedValue(draftNaming('notShippedYet'));

    const res = await request(makeApp())
      .patch('/api/ai-skills/a/versions/1.1')
      .send({ inputSchemaId: 'notShippedYet' });

    expect(res.status).toBe(200);
    expect(res.body.warnings).toContainEqual({
      code: 'SCHEMA_NOT_IN_CODE',
      schemaId: 'notShippedYet',
    });
    expect(res.body.versions[1].missingSchemaIds).toEqual(['notShippedYet']);
  });

  // What a task version consumes warns at publication, after the template's.
  it('POST a publication answers the warnings of the consumed expertises', async () => {
    const skill = {
      skillId: 'a',
      audience: 'all',
      versions: [{ versionMajor: 1, versionMinor: 0, nature: 'task' }],
    };
    const warning = {
      code: 'CONSUMED_EXPERTISES_NOT_PUBLISHED',
      expertiseIds: ['qc.draft'],
    };
    skillService.activateVersion.mockResolvedValue({ skill, warnings: [] });
    skillService.consumedExpertiseWarnings.mockResolvedValueOnce([warning]);

    const res = await request(makeApp())
      .post('/api/ai-skills/a/versions/1.0/activate')
      .send({ changelog: 'c', releaseNotes: 'r' });

    expect(res.status).toBe(200);
    expect(res.body.warnings).toEqual([warning]);
    expect(skillService.consumedExpertiseWarnings).toHaveBeenCalledWith(
      skill,
      skill.versions[0]
    );
  });

  // The publication is done: what it warns of cannot turn it into an error.
  it('POST a publication answers it, without warnings, when they cannot be read', async () => {
    const logger = require('../../../../packages/server/utils/logger.js');
    const logged = jest.spyOn(logger, 'error').mockImplementation(() => {});
    skillService.activateVersion.mockResolvedValue({
      skill: {
        skillId: 'a',
        status: 'ACTIVE',
        versions: [{ versionMajor: 1, versionMinor: 0, nature: 'task' }],
      },
      warnings: [],
    });
    skillService.consumedExpertiseWarnings.mockRejectedValueOnce(
      new Error('connection lost')
    );

    const res = await request(makeApp())
      .post('/api/ai-skills/a/versions/1.0/activate')
      .send({ changelog: 'c', releaseNotes: 'r' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ACTIVE', warnings: [] });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it('GET /api/ai-invocations forwards filters as query', async () => {
    invocationLog.listInvocations.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });
    const res = await request(makeApp())
      .get('/api/ai-invocations')
      .query({ skillId: 'a', status: 'SUCCESS' });
    expect(res.status).toBe(200);
    expect(invocationLog.listInvocations).toHaveBeenCalledWith(
      expect.objectContaining({ skillId: 'a', status: 'SUCCESS' })
    );
  });
});
