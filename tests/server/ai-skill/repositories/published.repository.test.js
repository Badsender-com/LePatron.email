/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// What leaves LePatron of a skill or an expertise (ADR 0012): the active
// version of an active item, read alone, with the fields asked for. Against
// the fake models, which run the aggregation as MongoDB does.

const { createMcpStore } = require('../../../helpers/mcp-fake-models.js');
const {
  published,
  findPublished,
} = require('../../../../packages/server/ai-skill/repositories/published.repository.js');

const version = (versionMajor, status, extra = {}) => ({
  versionMajor,
  versionMinor: 0,
  status,
  systemPrompt: `Prompt ${versionMajor}`,
  testCases: [{ name: 'a brief', input: { prompt: 'A long brief' } }],
  ...extra,
});
const SKILL = {
  _id: '507f1f77bcf86cd799439921',
  skillId: 'redaction.subject-ideas',
  title: 'Subject line ideas',
  status: 'ACTIVE',
  audience: 'all',
  activeVersion: { major: 2, minor: 0 },
  versions: [version(1, 'ARCHIVED'), version(2, 'ACTIVE'), version(3, 'DRAFT')],
};

describe('published.repository', () => {
  describe('published', () => {
    it('is the active version of an active item', () => {
      expect(published(SKILL)).toEqual({
        doc: SKILL,
        version: SKILL.versions[1],
      });
    });

    it.each([
      ['no item', null],
      ['a draft item', { ...SKILL, status: 'DRAFT' }],
      ['an item without an active version', { ...SKILL, activeVersion: {} }],
      [
        'an item whose active version is not ACTIVE',
        { ...SKILL, activeVersion: { major: 3, minor: 0 } },
      ],
    ])('is nothing for %s', (_case, doc) => {
      expect(published(doc)).toBeNull();
    });
  });

  describe('findPublished', () => {
    let LePatronSkills;

    beforeEach(() => {
      const store = createMcpStore();
      store.seed({
        skills: [
          SKILL,
          {
            ...SKILL,
            _id: '507f1f77bcf86cd799439922',
            skillId: 'qc.draft',
            status: 'DRAFT',
          },
        ],
      });
      ({ LePatronSkills } = store.models);
    });

    it('reads the active version alone, with the fields asked for only', async () => {
      const [found, ...others] = await findPublished(
        LePatronSkills,
        { audience: 'all' },
        { doc: ['skillId'], version: ['systemPrompt'] }
      );

      expect(others).toEqual([]);
      expect(found.doc).toEqual({
        _id: SKILL._id,
        skillId: SKILL.skillId,
        status: 'ACTIVE',
        activeVersion: SKILL.activeVersion,
        versions: [found.version],
      });
      expect(found.version).toEqual({
        versionMajor: 2,
        versionMinor: 0,
        status: 'ACTIVE',
        systemPrompt: 'Prompt 2',
      });
    });

    it.each([
      ['by name', { doc: [], version: ['testCases'] }],
      ['by a path inside', { doc: [], version: ['testCases.input'] }],
      ['through the history', { doc: ['versions'], version: [] }],
    ])(
      'never reads the test cases, even when asked %s',
      async (_case, fields) => {
        const spy = jest.spyOn(LePatronSkills, 'aggregate');

        const [found] = await findPublished(LePatronSkills, {}, fields);

        const [, , , { $project }] = spy.mock.calls[0][0];
        expect(Object.keys($project)).toEqual([
          'status',
          'activeVersion',
          'versions.versionMajor',
          'versions.versionMinor',
          'versions.status',
        ]);
        expect(found.version).not.toHaveProperty('testCases');
      }
    );
  });
});
