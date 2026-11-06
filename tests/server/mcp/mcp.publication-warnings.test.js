/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// publish_draft tells what a publication warns of, as the back office does
// (ADR 0013): a task skill's consumed expertise that is not published, said
// before the user agrees and once published, without stopping it.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const WRITE = ['mcp:read', 'skills:write'];
const PUBLISH = 'publish_draft';
const AUDIT = 'redaction.audit';
const DARK_MODE = 'design.dark-mode'; // never published

const SEED = {
  ...f.SEED,
  skills: [
    ...f.SKILLS,
    {
      _id: '507f1f77bcf86cd799439906',
      skillId: AUDIT,
      title: 'Audit',
      category: 'redaction',
      status: 'DRAFT',
      audience: 'platform',
      activeVersion: { major: null, minor: 0 },
      versions: [
        {
          versionMajor: 1,
          versionMinor: 0,
          status: 'DRAFT',
          nature: 'task',
          procedure: '## Steps',
          consumedExpertiseIds: [DARK_MODE],
          changelog: 'First',
          releaseNotes: 'First',
        },
      ],
    },
  ],
};

const NOT_PUBLISHED = {
  code: 'CONSUMED_EXPERTISES_NOT_PUBLISHED',
  expertiseIds: [DARK_MODE],
};

describe('publish_draft and what a publication warns of', () => {
  beforeEach(() => harness.seed(SEED));
  afterEach(() => harness.disconnect());

  const call = async (client, args) =>
    harness.answerOf(await client.callTool({ name: PUBLISH, arguments: args }));

  it('tells it at the check, and once published', async () => {
    const client = await harness.connectAs(f.ALICE, {
      group: f.PLATFORM_GROUP,
      scopes: WRITE,
    });

    const checked = await call(client, { kind: 'skill', id: AUDIT });
    const published = await call(client, {
      kind: 'skill',
      id: AUDIT,
      confirmation: checked.confirmation,
    });

    expect(checked.warnings).toEqual([NOT_PUBLISHED]);
    expect(published).toMatchObject({
      published: true,
      warnings: [NOT_PUBLISHED],
    });
  });
});
