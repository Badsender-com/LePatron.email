'use strict';

jest.mock('../../../packages/server/common/models.common.js', () => ({
  LePatronSkills: { find: jest.fn() },
  Expertises: { find: jest.fn() },
}));

const {
  scanInvocations,
  loadManifests,
  checkSchemaReferences,
} = require('../../../scripts/check-skill-usage');
const {
  LePatronSkills,
} = require('../../../packages/server/common/models.common.js');

describe('check-skill-usage script', () => {
  it('loadManifests picks up the translation squelette', () => {
    const manifests = loadManifests();
    const translation = manifests.find(
      (m) => m.manifest.featureType === 'translation'
    );
    expect(translation).toBeDefined();
    expect(Array.isArray(translation.manifest.usedSkills)).toBe(true);
  });

  it('scanInvocations does not pick up the service file itself (excluded)', () => {
    const map = scanInvocations();
    // No real production caller exists yet → empty map. This test mostly
    // guards against accidentally regressing the exclusion (which would
    // produce false-positive undeclared invocations on every run).
    expect(map.size).toBe(0);
  });
});

describe('checkSchemaReferences', () => {
  // The registry is real (it lives in code); only the DB read is faked, so the
  // test asserts the actual code ↔ database contract.
  function mockSkills(skills) {
    LePatronSkills.find.mockReturnValue({
      lean: () => Promise.resolve(skills),
    });
  }

  beforeEach(() => jest.clearAllMocks());

  it('accepts versions whose schema ids resolve in the registry', async () => {
    mockSkills([
      {
        skillId: 'redaction.cta',
        versions: [
          {
            versionMajor: 1,
            versionMinor: 0,
            status: 'ACTIVE',
            inputSchemaId: 'genericTextInput',
            outputSchemaId: 'genericTextOutput',
          },
        ],
      },
    ]);
    await expect(checkSchemaReferences()).resolves.toEqual([]);
  });

  it('reports an id that no longer exists in the registry', async () => {
    mockSkills([
      {
        skillId: 'redaction.cta',
        versions: [
          {
            versionMajor: 2,
            versionMinor: 1,
            status: 'ACTIVE',
            inputSchemaId: 'renamedAwayInput',
            outputSchemaId: 'genericTextOutput',
          },
        ],
      },
    ]);
    const errors = await checkSchemaReferences();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('redaction.cta');
    expect(errors[0]).toContain('v2.1');
    expect(errors[0]).toContain('inputSchemaId');
    expect(errors[0]).toContain('renamedAwayInput');
  });

  it('ignores ARCHIVED versions, which can no longer be invoked', async () => {
    mockSkills([
      {
        skillId: 'qc.subject',
        versions: [
          {
            versionMajor: 1,
            versionMinor: 0,
            status: 'ARCHIVED',
            inputSchemaId: 'goneInput',
            outputSchemaId: 'goneOutput',
          },
        ],
      },
    ]);
    await expect(checkSchemaReferences()).resolves.toEqual([]);
  });

  it('tolerates the empty ids of a fresh DRAFT', async () => {
    mockSkills([
      {
        skillId: 'design.layout',
        versions: [
          {
            versionMajor: 1,
            versionMinor: 0,
            status: 'DRAFT',
            inputSchemaId: '',
            outputSchemaId: '',
          },
        ],
      },
    ]);
    await expect(checkSchemaReferences()).resolves.toEqual([]);
  });

  it('reports both fields of a DRAFT that will fail at activation', async () => {
    mockSkills([
      {
        skillId: 'design.layout',
        versions: [
          {
            versionMajor: 1,
            versionMinor: 0,
            status: 'DRAFT',
            inputSchemaId: 'nope',
            outputSchemaId: 'alsoNope',
          },
        ],
      },
    ]);
    await expect(checkSchemaReferences()).resolves.toHaveLength(2);
  });
});
