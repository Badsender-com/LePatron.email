/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The routes of the skills export (ADR 0018): only a super admin exports,
// previews or imports, and a file that cannot be read is refused whole,
// before any preview. The rules themselves are tested on the service
// (tests/server/ai-skill/skills-export.service.test.js).

const { createMcpStore } = require('../../../helpers/mcp-fake-models');

const store = createMcpStore();
jest.doMock(
  '../../../../packages/server/common/models.common.js',
  () => store.models
);
jest.doMock('../../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
// The real rule: the platform capability.
jest.doMock('../../../../packages/server/account/auth.guard', () => ({
  GUARD_ADMIN: (req, res, next) => {
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
const f = require('../../../helpers/mcp-fixtures');
const {
  skillsRouter,
  skillsImportBodyParser,
} = require('../../../../packages/server/ai-skill/ai-skill.routes');

const SUBJECT_LINES = 'redaction.subject-line';

function makeApp(user) {
  const app = express();
  // As the app mounts them (packages/server/index.js): the import's own
  // parser first, then every other body up to 50 MB.
  app.use('/api/ai-skills/import', skillsImportBodyParser);
  app.use(express.json({ limit: '50mb' }));
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/api/ai-skills', skillsRouter);
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return app;
}

const SUPER_ADMIN = { id: f.ALICE, name: 'Alice', role: 'super_admin' };
const COMPANY_ADMIN = { id: f.ERIN, name: 'Erin', role: 'company_admin' };

describe('exporting through the API', () => {
  beforeEach(() => store.seed(f.SEED));

  it('downloads a skills export to a super admin', async () => {
    const res = await request(makeApp(SUPER_ADMIN))
      .post('/api/ai-skills/export')
      .send({ expertiseIds: [SUBJECT_LINES] });

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="lepatron-skills-.+-\d{4}-\d{2}-\d{2}\.json"/
    );
    expect(JSON.parse(res.text)).toMatchObject({
      format: 1,
      expertises: [expect.objectContaining({ expertiseId: SUBJECT_LINES })],
    });
  });

  it('refuses a selection that is not a list of ids', async () => {
    const res = await request(makeApp(SUPER_ADMIN))
      .post('/api/ai-skills/export')
      .send({ skillIds: 'redaction.subject-ideas' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('SKILLS_SELECTION_INVALID');
  });

  it('refuses anyone else', async () => {
    const res = await request(makeApp(COMPANY_ADMIN))
      .post('/api/ai-skills/export')
      .send({ all: true });

    expect(res.status).toBe(401);
  });
});

describe('previewing through the API', () => {
  let file;
  beforeEach(async () => {
    store.seed(f.SEED);
    file = JSON.parse(
      (
        await request(makeApp(SUPER_ADMIN))
          .post('/api/ai-skills/export')
          .send({ all: true })
      ).text
    );
  });

  it('previews a file for a super admin', async () => {
    const res = await request(makeApp(SUPER_ADMIN))
      .post('/api/ai-skills/import/preview')
      .send(file);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: SUBJECT_LINES, state: 'up_to_date' }),
      ])
    );
  });

  it('refuses anyone else', async () => {
    const res = await request(makeApp(COMPANY_ADMIN))
      .post('/api/ai-skills/import/preview')
      .send(file);

    expect(res.status).toBe(401);
  });

  it('refuses a file of an unknown format before any preview', async () => {
    const res = await request(makeApp(SUPER_ADMIN))
      .post('/api/ai-skills/import/preview')
      .send({ ...file, format: 2 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('SKILLS_EXPORT_FORMAT_UNKNOWN');
    expect(res.body.items).toBeUndefined();
  });

  // A real export is larger than a usual body, and the route sets its own cap.
  it('reads a file of a few megabytes, and refuses one over 5 MB', async () => {
    const padding = (size) => ({
      ...file,
      expertises: file.expertises.map((e, i) =>
        i === 0
          ? { ...e, version: { ...e.version, body: 'x'.repeat(size) } }
          : e
      ),
    });

    const large = await request(makeApp(SUPER_ADMIN))
      .post('/api/ai-skills/import/preview')
      .send(padding(2 * 1024 * 1024));
    const tooLarge = await request(makeApp(SUPER_ADMIN))
      .post('/api/ai-skills/import/preview')
      .send(padding(6 * 1024 * 1024));

    expect(large.status).toBe(200);
    expect(tooLarge.status).toBe(413);
  });
});

describe('importing through the API', () => {
  let file;
  beforeEach(async () => {
    store.seed(f.SEED);
    file = JSON.parse(
      (
        await request(makeApp(SUPER_ADMIN))
          .post('/api/ai-skills/export')
          .send({ expertiseIds: [SUBJECT_LINES] })
      ).text
    );
    store.seed({ ...f.SEED, expertises: [], skills: [] });
  });

  it('imports the chosen items and answers the report', async () => {
    const res = await request(makeApp(SUPER_ADMIN))
      .post('/api/ai-skills/import')
      .send({ file, expertiseIds: [SUBJECT_LINES] });

    expect(res.status).toBe(200);
    expect(res.body.created).toEqual([
      { kind: 'expertise', id: SUBJECT_LINES, version: '2.1' },
    ]);
  });

  it('refuses a choice that is not a list of ids', async () => {
    const res = await request(makeApp(SUPER_ADMIN))
      .post('/api/ai-skills/import')
      .send({ file, expertiseIds: SUBJECT_LINES });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('SKILLS_SELECTION_INVALID');
    expect(store.stored('expertises')).toEqual([]);
  });

  it('refuses anyone else, and writes nothing', async () => {
    const res = await request(makeApp(COMPANY_ADMIN))
      .post('/api/ai-skills/import')
      .send({ file, expertiseIds: [SUBJECT_LINES] });

    expect(res.status).toBe(401);
    expect(store.stored('expertises')).toEqual([]);
  });
});
