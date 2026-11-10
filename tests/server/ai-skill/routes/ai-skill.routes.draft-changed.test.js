/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// A person never writes over an assistant's proposal unread (ADR 0014): the
// back office sends the update date of the draft its screen read, with a save
// and with a publication, and a draft written since is refused with a 409
// the screen tells. A request without it, from an older client, writes as
// before.

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
const expertiseService = require('../../../../packages/server/ai-skill/services/expertise.service.js');

const READ_AT = new Date('2026-11-01T10:00:00Z');
const BASE = '/api/ai-expertise/qc.rules';

beforeEach(() =>
  mockStore.seed({
    expertises: [
      {
        _id: '507f1f77bcf86cd799439a99',
        expertiseId: 'qc.rules',
        title: 'Rules',
        category: 'qc',
        status: 'ACTIVE',
        audience: 'platform',
        activeVersion: { major: 1, minor: 0 },
        versions: [
          { versionMajor: 1, versionMinor: 0, status: 'ACTIVE', body: 'One' },
          {
            versionMajor: 1,
            versionMinor: 1,
            status: 'DRAFT',
            body: 'Two',
            changelog: 'By a person',
            updatedAt: READ_AT,
          },
        ],
      },
    ],
  })
);

const draftOf = async () =>
  (await request(aiSkillApp()).get(BASE)).body.versions.find(
    (v) => v.versionMinor === 1
  );
const save = (body) =>
  request(aiSkillApp()).patch(`${BASE}/versions/1.1`).send(body);
const publish = (body) =>
  request(aiSkillApp()).post(`${BASE}/versions/1.1/activate`).send(body);

// What an assistant writes, through the same service as MCP.
async function proposeFromAnAssistant(body) {
  const { doc, version } = await expertiseService.openOrStartDraft('qc.rules');
  await expertiseService.writeDraftIfUnchanged(
    doc,
    version,
    { body, changelog: 'By an assistant' },
    null
  );
}

describe('a draft an assistant wrote since the screen read it', () => {
  it('is not saved over', async () => {
    const read = await draftOf();
    await proposeFromAnAssistant('From the assistant');

    const res = await save({
      body: 'From the person',
      updatedAt: read.updatedAt,
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('SKILL_VERSION_CHANGED');
    expect((await draftOf()).body).toBe('From the assistant');
  });

  it('is not published unread', async () => {
    const read = await draftOf();
    await proposeFromAnAssistant('From the assistant');

    const res = await publish({ updatedAt: read.updatedAt });

    expect(res.status).toBe(409);
    expect((await draftOf()).status).toBe('DRAFT');
  });

  it('is saved once the screen read it again', async () => {
    await proposeFromAnAssistant('From the assistant');
    const read = await draftOf();

    const res = await save({
      body: 'From the person',
      updatedAt: read.updatedAt,
    });

    expect(res.status).toBe(200);
    expect((await draftOf()).body).toBe('From the person');
  });

  it('is saved as before by a request that sends no update date', async () => {
    await proposeFromAnAssistant('From the assistant');

    const res = await save({ body: 'From an older client' });

    expect(res.status).toBe(200);
    expect((await draftOf()).body).toBe('From an older client');
  });
});
