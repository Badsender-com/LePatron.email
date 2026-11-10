'use strict';

/**
 * The skills and expertises the tests of opening a task skill to every
 * company seed (ADR 0013), on the fake models (mcp-fake-models.js):
 *
 * - `qc.review`, a draft kept to the platform company, consumes `brand.tone`
 *   (open to all), `qc.proving` (kept to the platform company) and
 *   `qc.draft` (not published);
 * - `qc.live`, published and kept to the platform company, consumes
 *   `qc.proving`;
 * - `qc.open`, published and open to all, consumes `qc.proving`, as do
 *   `qc.open-feature` (a feature version), `qc.closed` (kept to the platform
 *   company) and the archived version of `qc.moved-on`;
 * - `qc.other` is an expertise no skill consumes.
 */

let count = 0;
const nextId = () =>
  `507f1f77bcf86cd7994397${String((count = (count % 99) + 1)).padStart(
    2,
    '0'
  )}`;

const version = (status, fields = {}) => ({
  versionMajor: 1,
  versionMinor: 0,
  status,
  ...fields,
});
const expertise = (expertiseId, title, fields = {}) => ({
  _id: nextId(),
  expertiseId,
  title,
  status: 'ACTIVE',
  audience: 'platform',
  activeVersion: { major: 1, minor: 0 },
  versions: [version('ACTIVE')],
  ...fields,
});
const taskVersion = (status, consumedExpertiseIds) =>
  version(status, { nature: 'task', procedure: 'Do it', consumedExpertiseIds });
const skill = (skillId, fields = {}) => ({
  _id: nextId(),
  skillId,
  title: `Skill ${skillId}`,
  status: 'ACTIVE',
  audience: 'all',
  activeVersion: { major: 1, minor: 0 },
  versions: [taskVersion('ACTIVE', ['qc.proving'])],
  ...fields,
});
const DRAFT_ONLY = Object.freeze({
  status: 'DRAFT',
  activeVersion: { major: null, minor: 0 },
});

/**
 * @param {Object} store the fake models' store
 */
function seedOpening(store) {
  store.seed({
    expertises: [
      expertise('brand.tone', 'Brand tone', { audience: 'all' }),
      expertise('qc.proving', 'Still proven'),
      expertise('qc.other', 'Not consumed'),
      expertise('qc.draft', 'A draft', {
        ...DRAFT_ONLY,
        versions: [version('DRAFT')],
      }),
    ],
    skills: [
      skill('qc.review', {
        ...DRAFT_ONLY,
        audience: 'platform',
        versions: [
          taskVersion('DRAFT', ['brand.tone', 'qc.proving', 'qc.draft']),
        ],
      }),
      skill('qc.live', { audience: 'platform' }),
      skill('qc.open'),
      skill('qc.open-feature', {
        versions: [
          version('ACTIVE', {
            nature: 'feature',
            consumedExpertiseIds: ['qc.proving'],
          }),
        ],
      }),
      skill('qc.closed', { audience: 'platform' }),
      skill('qc.moved-on', {
        activeVersion: { major: 2, minor: 0 },
        versions: [
          taskVersion('ARCHIVED', ['qc.proving']),
          { ...taskVersion('ACTIVE', ['brand.tone']), versionMajor: 2 },
        ],
      }),
    ],
  });
}

module.exports = { seedOpening, expertise, version, DRAFT_ONLY };
