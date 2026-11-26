/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// A release note and a change log at every publication from the back office
// too (ADR 0031): the publication route, on the real services, refuses a
// minor version without both, and a release note over 500 characters.

jest.mock('../../../../packages/server/common/models.common', () => {
  const { createMcpStore } = require('../../../helpers/mcp-fake-models.js');
  const store = createMcpStore();
  return { ...store.models, mockStore: store };
});
jest.mock('../../../../packages/server/account/auth.guard', () =>
  require('../../../helpers/ai-skill-app.js').guardOnCapability()
);

const request = require('../../../helpers/local-request.js');
const { aiSkillApp } = require('../../../helpers/ai-skill-app.js');
const {
  mockStore,
} = require('../../../../packages/server/common/models.common');

const version = (versionMinor, status) => ({
  versionMajor: 1,
  versionMinor,
  status,
  body: `## Body\n\nVersion 1.${versionMinor}.`,
  changelog: '',
  releaseNotes: '',
});

beforeEach(() =>
  mockStore.seed({
    expertises: [
      {
        _id: '507f1f77bcf86cd799439711',
        expertiseId: 'redaction.subject-line',
        title: 'Subject lines',
        category: 'redaction',
        scope: ['subject'],
        status: 'ACTIVE',
        audience: 'all',
        activeVersion: { major: 1, minor: 0 },
        versions: [version(0, 'ACTIVE'), version(1, 'DRAFT')],
      },
    ],
    skills: [],
  })
);

const publish = (body) =>
  request(aiSkillApp())
    .post('/api/ai-expertise/redaction.subject-line/versions/1.1/activate')
    .send(body);
const activeVersion = async () =>
  (await request(aiSkillApp()).get('/api/ai-expertise/redaction.subject-line'))
    .body.activeVersion;

// Turned on by #1665 (a publication requires both texts)
describe('publication route requires both texts', () => {
  it('refuses a minor version without a release note', async () => {
    const res = await publish({ changelog: 'Typo' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('RELEASE_NOTE_REQUIRED');
    expect(await activeVersion()).toEqual({ major: 1, minor: 0 });
  });

  it('refuses the generic sentence a minor version used to get as a release note', async () => {
    const res = await publish({
      changelog: 'Typo',
      releaseNotes: 'Correction mineure sans changement de doctrine.',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('RELEASE_NOTE_REQUIRED');
    expect(await activeVersion()).toEqual({ major: 1, minor: 0 });
  });

  it('refuses a minor version without a change log', async () => {
    const res = await publish({ releaseNotes: 'Subjects get shorter.' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('CHANGELOG_REQUIRED');
  });

  it('refuses a release note over 500 characters', async () => {
    const res = await publish({
      changelog: 'Typo',
      releaseNotes: 'x'.repeat(501),
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      message: 'RELEASE_NOTE_TOO_LONG',
      max: 500,
    });
  });

  it('publishes a minor version with both texts', async () => {
    const res = await publish({
      changelog: 'Typo',
      releaseNotes: 'Subjects get shorter.',
    });

    expect(res.status).toBe(200);
    expect(await activeVersion()).toEqual({ major: 1, minor: 1 });
  });
});
