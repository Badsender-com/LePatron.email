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
// The file's origin is the site's, read as the rest of the site reads it,
// not through the emails' module, which loads its templates on start.
jest.doMock(
  '../../../../packages/server/email-templates/email-template.js',
  () => {
    throw new Error('the skills export does not send emails');
  }
);
const express = require('express');
const request = require('../../../helpers/local-request.js');
const f = require('../../../helpers/mcp-fixtures');
const { ROLES } = require('../../../../packages/shared/access/roles.js');
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
});

// Only a super admin exports, previews or imports, through the guard the
// routes use (docs/agents/rights-review.md: a right is tested on every
// role). A refused import writes nothing.
describe('who may use the skills export', () => {
  const ROUTES = [
    ['export', '/api/ai-skills/export'],
    ['preview', '/api/ai-skills/import/preview'],
    ['import', '/api/ai-skills/import'],
  ];
  const EXPECTED = {
    [ROLES.SUPER_ADMIN]: 200,
    [ROLES.GROUP_ADMIN_TECH]: 401,
    [ROLES.GROUP_ADMIN]: 401,
    [ROLES.REGULAR_USER]: 401,
    [ROLES.WRITER]: 401,
    [ROLES.REVIEWER]: 401,
  };
  const CASES = ROUTES.flatMap(([name, path]) =>
    Object.values(ROLES).map((role) => [name, role, path, EXPECTED[role]])
  );

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

  const bodyOf = (name) =>
    ({
      export: { all: true },
      preview: file,
      import: { file, expertiseIds: [SUBJECT_LINES] },
    }[name]);

  it('names every role', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(Object.values(ROLES).sort());
  });

  it.each(CASES)(
    '%s, as %s: %s answers %i',
    async (name, role, path, status) => {
      const user = { id: f.ALICE, name: 'Someone', role };

      const res = await request(makeApp(user)).post(path).send(bodyOf(name));

      expect(res.status).toBe(status);
      if (name === 'import' && status !== 200) {
        expect(store.stored('expertises')).toEqual([]);
      }
    }
  );
});
