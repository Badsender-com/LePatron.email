/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// What publishing a task skill's version warns of, without refusing it (ADR
// 0013): a consumed expertise that is not published, which no assistant is
// served, and one kept to the platform company, which the assistants of the
// other companies are not served while the skill is open to them.

jest.mock('../../../../packages/server/common/models.common', () => {
  const { createMcpStore } = require('../../../helpers/mcp-fake-models.js');
  const store = createMcpStore();
  return { ...store.models, mockStore: store };
});

const {
  consumedExpertiseWarnings,
} = require('../../../../packages/server/ai-skill/services/consumed-expertises.js');
const {
  mockStore,
} = require('../../../../packages/server/common/models.common');

const active = { versionMajor: 1, versionMinor: 0, status: 'ACTIVE' };
let count = 0;
const expertise = (expertiseId, fields = {}) => ({
  _id: `507f1f77bcf86cd7994398${String((count += 1)).padStart(2, '0')}`,
  expertiseId,
  status: 'ACTIVE',
  audience: 'all',
  activeVersion: { major: 1, minor: 0 },
  versions: [active],
  ...fields,
});
const EXPERTISES = [
  expertise('brand.tone'),
  expertise('qc.draft', {
    status: 'DRAFT',
    activeVersion: { major: null, minor: 0 },
    versions: [{ ...active, status: 'DRAFT' }],
  }),
  expertise('qc.archived-one', {
    status: 'ARCHIVED',
    versions: [{ ...active, status: 'ARCHIVED' }],
  }),
  expertise('qc.proving', { audience: 'platform' }),
  expertise('qc.no-audience', { audience: undefined }),
];

const taskVersion = (consumedExpertiseIds) => ({
  nature: 'task',
  consumedExpertiseIds,
});
const codes = (warnings) =>
  Object.fromEntries(warnings.map((w) => [w.code, w.expertiseIds]));

beforeEach(() => mockStore.seed({ expertises: EXPERTISES }));

describe('the warnings of a publication on the consumed expertises', () => {
  it('names those that are not published, in their order', async () => {
    const warnings = await consumedExpertiseWarnings(
      { audience: 'platform' },
      taskVersion(['qc.archived-one', 'brand.tone', 'qc.draft'])
    );

    expect(warnings).toEqual([
      {
        code: 'CONSUMED_EXPERTISES_NOT_PUBLISHED',
        expertiseIds: ['qc.archived-one', 'qc.draft'],
      },
    ]);
  });

  it('names those kept to the platform company, when the skill is open to all', async () => {
    const warnings = await consumedExpertiseWarnings(
      { audience: 'all' },
      taskVersion(['qc.proving', 'brand.tone', 'qc.no-audience'])
    );

    expect(codes(warnings)).toEqual({
      CONSUMED_EXPERTISES_PLATFORM_ONLY: ['qc.proving', 'qc.no-audience'],
    });
  });

  it('says nothing of those kept to the platform company, while the skill is too', async () => {
    const warnings = await consumedExpertiseWarnings(
      { audience: 'platform' },
      taskVersion(['qc.proving'])
    );

    expect(warnings).toEqual([]);
  });

  it('gives both warnings at once', async () => {
    const warnings = await consumedExpertiseWarnings(
      { audience: 'all' },
      taskVersion(['qc.draft', 'qc.proving'])
    );

    expect(codes(warnings)).toEqual({
      CONSUMED_EXPERTISES_NOT_PUBLISHED: ['qc.draft'],
      CONSUMED_EXPERTISES_PLATFORM_ONLY: ['qc.proving'],
    });
  });

  it.each([
    [
      'a feature version',
      { nature: 'feature', consumedExpertiseIds: ['qc.draft'] },
    ],
    ['a version that consumes none', taskVersion([])],
    ['no version', undefined],
  ])('says nothing of %s', async (_case, version) => {
    expect(
      await consumedExpertiseWarnings({ audience: 'all' }, version)
    ).toEqual([]);
  });
});
