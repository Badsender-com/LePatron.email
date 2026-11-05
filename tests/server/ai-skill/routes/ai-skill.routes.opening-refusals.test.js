/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// What opening a task skill to every company refuses (ADR 0013), on the real
// services: expertises named outside the request that opens the skill, or
// other than those the confirmation offers (the published expertises the
// version consumes kept to the platform company), and anyone but a super
// admin. A refusal writes nothing.

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
const { seedOpening } = require('../../../helpers/ai-skill-opening-seed.js');
const {
  MAX_CONSUMED_EXPERTISES,
} = require('../../../../packages/shared/ai-skill/constants.js');
const {
  mockStore,
} = require('../../../../packages/server/common/models.common');

beforeEach(() => seedOpening(mockStore));

const COMPANY_ADMIN = Object.freeze({
  id: '507f1f77bcf86cd799439002',
  role: 'company_admin',
});

const publish = (body, user) =>
  request(aiSkillApp(user))
    .post('/api/ai-skills/qc.review/versions/1.0/activate')
    .send({ changelog: 'c', releaseNotes: 'r', ...body });
const patch = (body, user) =>
  request(aiSkillApp(user)).patch('/api/ai-skills/qc.live').send(body);
const read = async (path) => (await request(aiSkillApp()).get(path)).body;
const audienceOf = async (kind, id) =>
  (await read(`/api/${kind}/${id}`)).audience;

const expectNothingOpened = async () => {
  expect(await read('/api/ai-skills/qc.review')).toMatchObject({
    status: 'DRAFT',
    audience: 'platform',
  });
  expect(await audienceOf('ai-skills', 'qc.live')).toBe('platform');
  for (const id of ['qc.proving', 'qc.other']) {
    expect(await audienceOf('ai-expertise', id)).toBe('platform');
  }
};

describe('the expertises named to open with a publication', () => {
  it.each([
    ['an expertise the version does not consume', ['qc.other'], ['qc.other']],
    ['one it consumes already open', ['brand.tone'], ['brand.tone']],
    ['one it consumes not published', ['qc.draft'], ['qc.draft']],
    [
      'only the ones not offered, each once',
      ['qc.proving', 'qc.other', 'qc.other'],
      ['qc.other'],
    ],
    ['what is not a list', 'qc.proving', []],
    ['what is not an expertise id', ['Not an id!'], []],
    ['an operator', [{ $ne: null }], []],
    [
      'a list longer than a version consumes',
      Array(MAX_CONSUMED_EXPERTISES + 1).fill('qc.proving'),
      [],
    ],
  ])(
    'refuses %s, and publishes nothing',
    async (_case, openExpertiseIds, expertiseIds) => {
      const res = await publish({ openToAll: true, openExpertiseIds });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        message: 'SKILL_OPEN_EXPERTISES_INVALID',
      });
      expect(res.body.expertiseIds).toEqual(expertiseIds);
      await expectNothingOpened();
    }
  );

  it.each([
    ['without openToAll', {}],
    ['with openToAll other than true', { openToAll: 'true' }],
  ])('refuses them %s', async (_case, body) => {
    const res = await publish({ ...body, openExpertiseIds: ['qc.proving'] });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('SKILL_OPEN_EXPERTISES_INVALID');
    await expectNothingOpened();
  });
});

describe('the expertises named to open with a change of audience', () => {
  it.each([
    ['that does not open the skill', {}],
    ['that keeps it to the platform company', { audience: 'platform' }],
  ])('are refused in a patch %s', async (_case, body) => {
    const res = await patch({ ...body, openExpertiseIds: ['qc.proving'] });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('SKILL_OPEN_EXPERTISES_INVALID');
    await expectNothingOpened();
  });

  it('are refused when the active version does not consume them', async () => {
    const res = await patch({
      audience: 'all',
      openExpertiseIds: ['qc.proving', 'qc.other'],
    });

    expect(res.status).toBe(400);
    expect(res.body.expertiseIds).toEqual(['qc.other']);
    await expectNothingOpened();
  });
});

describe('a member of a company who is not a super admin', () => {
  it.each([
    ['/api/ai-skills/qc.review/versions/1.0/platform-only-expertises'],
    ['/api/ai-expertise/qc.proving/open-task-skills'],
  ])('cannot read %s', async (path) => {
    const res = await request(aiSkillApp(COMPANY_ADMIN)).get(path);

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('expertises');
    expect(res.body).not.toHaveProperty('skills');
  });

  it('cannot open a skill and its expertises from its details', async () => {
    const res = await patch(
      { audience: 'all', openExpertiseIds: ['qc.proving'] },
      COMPANY_ADMIN
    );

    expect(res.status).toBe(401);
    await expectNothingOpened();
  });

  it('cannot publish a skill opening its expertises', async () => {
    const res = await publish(
      { openToAll: true, openExpertiseIds: ['qc.proving'] },
      COMPANY_ADMIN
    );

    expect(res.status).toBe(401);
    await expectNothingOpened();
  });
});
