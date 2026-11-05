/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Opening a task skill to every company (ADR 0013), on the real services: at
// publication or from its details, in one request, with the consumed
// expertises chosen to open with it; and the other way, the open task skills
// an expertise kept to the platform company again leaves without it.

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
  seedOpening,
  expertise,
  version,
  DRAFT_ONLY,
} = require('../../../helpers/ai-skill-opening-seed.js');
const {
  mockStore,
} = require('../../../../packages/server/common/models.common');

beforeEach(() => seedOpening(mockStore));

const app = () => aiSkillApp();
const publish = (body) =>
  request(app())
    .post('/api/ai-skills/qc.review/versions/1.0/activate')
    .send({ changelog: 'c', releaseNotes: 'r', ...body });
const read = async (path) => (await request(app()).get(path)).body;
const codes = (warnings) =>
  Object.fromEntries(warnings.map((w) => [w.code, w.expertiseIds]));

describe('publishing a task skill open to every company', () => {
  it('opens it in the same request, and warns of what it consumes kept to the platform company', async () => {
    const res = await publish({ openToAll: true });

    expect(res.status).toBe(200);
    expect(res.body.audience).toBe('all');
    expect((await read('/api/ai-skills/qc.review')).audience).toBe('all');
    expect(codes(res.body.warnings)).toEqual({
      CONSUMED_EXPERTISES_NOT_PUBLISHED: ['qc.draft'],
      CONSUMED_EXPERTISES_PLATFORM_ONLY: ['qc.proving'],
    });
  });

  it('keeps it to the platform company unless asked, and warns of nothing kept', async () => {
    const res = await publish({});

    expect(res.body.audience).toBe('platform');
    expect(codes(res.body.warnings)).toEqual({
      CONSUMED_EXPERTISES_NOT_PUBLISHED: ['qc.draft'],
    });
  });

  it('opens the consumed expertises chosen with it', async () => {
    const res = await publish({
      openToAll: true,
      openExpertiseIds: ['qc.proving'],
    });

    expect(res.status).toBe(200);
    expect((await read('/api/ai-expertise/qc.proving')).audience).toBe('all');
    expect(codes(res.body.warnings)).not.toHaveProperty(
      'CONSUMED_EXPERTISES_PLATFORM_ONLY'
    );
  });

  it('lists what the version consumes kept to the platform company, to choose from', async () => {
    expect(
      await read(
        '/api/ai-skills/qc.review/versions/1.0/platform-only-expertises'
      )
    ).toEqual({
      expertises: [{ expertiseId: 'qc.proving', title: 'Still proven' }],
    });
    const res = await request(app()).get(
      '/api/ai-skills/qc.review/versions/9.0/platform-only-expertises'
    );
    expect(res.status).toBe(404);
  });
});

describe('opening a task skill from its details', () => {
  const patch = (body) =>
    request(app()).patch('/api/ai-skills/qc.live').send(body);

  it('opens the expertises its active version consumes, chosen with it', async () => {
    const res = await patch({
      audience: 'all',
      openExpertiseIds: ['qc.proving'],
    });

    expect(res.status).toBe(200);
    expect(res.body.audience).toBe('all');
    expect((await read('/api/ai-expertise/qc.proving')).audience).toBe('all');
  });

  it('opens the skill alone when none is chosen', async () => {
    await patch({ audience: 'all', openExpertiseIds: [] });

    expect((await read('/api/ai-skills/qc.live')).audience).toBe('all');
    expect((await read('/api/ai-expertise/qc.proving')).audience).toBe(
      'platform'
    );
  });
});

describe('an expertise kept to the platform company again', () => {
  it('names the open task skills whose active version consumes it', async () => {
    expect(
      await read('/api/ai-expertise/qc.proving/open-task-skills')
    ).toEqual({ skills: [{ skillId: 'qc.open', title: 'Skill qc.open' }] });
  });

  it('names none for an expertise no open task skill consumes', async () => {
    expect(await read('/api/ai-expertise/qc.other/open-task-skills')).toEqual({
      skills: [],
    });
  });
});

describe('publishing an expertise open to every company', () => {
  it('opens it in the same request', async () => {
    mockStore.seed({
      expertises: [
        expertise('qc.new', 'New', {
          ...DRAFT_ONLY,
          versions: [version('DRAFT', { body: '# New' })],
        }),
      ],
    });

    const res = await request(app())
      .post('/api/ai-expertise/qc.new/versions/1.0/activate')
      .send({ changelog: 'c', releaseNotes: 'r', openToAll: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ACTIVE', audience: 'all' });
  });
});
