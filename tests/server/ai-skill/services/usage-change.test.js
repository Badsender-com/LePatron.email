/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// What a feature uses changes without a new version (ADR 0019): the scope or
// the category of an active expertise, an item archived. Nothing is
// replayed: the change warns of its impact and is kept on the item.
// Archiving a skill a feature calls is confirmed first.

const { createMcpStore } = require('../../../helpers/mcp-fake-models');

const store = createMcpStore();
jest.doMock(
  '../../../../packages/server/common/models.common.js',
  () => store.models
);

// Subject line generation calls the subject ideas skill and loads the
// redaction expertises of the subject.
const SUBJECT_FEATURE = {
  featureType: 'subject_generation',
  description: 'Subject line generation',
  usedSkills: ['redaction.subject-ideas'],
  usedExpertise: [],
  expertiseFilters: [{ scope: ['subject'], categories: ['redaction'] }],
};
jest.doMock(
  '../../../../packages/server/ai-skill/services/manifest-registry.js',
  () => ({
    ...jest.requireActual(
      '../../../../packages/server/ai-skill/services/manifest-registry.js'
    ),
    listManifests: () => [SUBJECT_FEATURE],
  })
);

const f = require('../../../helpers/mcp-fixtures');
const ERROR_CODES = require('../../../../packages/server/constant/error-codes');
const skillService = require('../../../../packages/server/ai-skill/services/skill.service');
const expertiseService = require('../../../../packages/server/ai-skill/services/expertise.service');

const SUBJECT_LINES = 'redaction.subject-line';
const SPAM_WORDS = 'deliverability.spam-words';
const SUBJECT_IDEAS = 'redaction.subject-ideas';
const UNRELEASED = 'qc.unreleased';
const LOST = {
  code: 'USED_BY_FEATURES_LOST',
  features: ['Subject line generation'],
};

const stored = (collection, idField, id) =>
  store.stored(collection).find((doc) => doc[idField] === id);

beforeEach(() => store.seed(f.SEED));

describe('a change of what a feature uses, without a new version', () => {
  it('warns that a feature stops loading an expertise whose scope changed, and keeps it', async () => {
    const { warnings } = await expertiseService.updateExpertise(
      SUBJECT_LINES,
      { scope: ['body'] },
      f.ALICE
    );

    expect(warnings).toEqual([LOST]);
    expect(
      stored('expertises', 'expertiseId', SUBJECT_LINES).usageHistory
    ).toEqual([
      expect.objectContaining({
        change: 'identity',
        by: f.ALICE,
        lost: ['subject_generation'],
        gained: [],
      }),
    ]);
  });

  it('warns that a feature starts loading an expertise whose category changed', async () => {
    await expertiseService.updateExpertise(SPAM_WORDS, { scope: ['subject'] });

    const { warnings } = await expertiseService.updateExpertise(
      SPAM_WORDS,
      { category: 'redaction' },
      f.ALICE
    );

    expect(warnings).toEqual([
      {
        code: 'USED_BY_FEATURES_GAINED',
        features: ['Subject line generation'],
      },
    ]);
  });

  it('says nothing, and keeps nothing, of a change no feature sees', async () => {
    const { warnings } = await expertiseService.updateExpertise(
      SUBJECT_LINES,
      { title: 'Subject lines' },
      f.ALICE
    );

    expect(warnings).toEqual([]);
    expect(
      stored('expertises', 'expertiseId', SUBJECT_LINES).usageHistory || []
    ).toEqual([]);
  });

  it('warns that a feature stops loading an expertise archived, and keeps it', async () => {
    const { warnings } = await expertiseService.archiveExpertise(
      SUBJECT_LINES,
      { userId: f.ALICE }
    );

    expect(warnings).toEqual([LOST]);
    expect(
      stored('expertises', 'expertiseId', SUBJECT_LINES).usageHistory
    ).toEqual([
      expect.objectContaining({
        change: 'archived',
        lost: ['subject_generation'],
      }),
    ]);
  });

  it('archives a skill a feature calls only once confirmed', async () => {
    await expect(
      skillService.archiveSkill(SUBJECT_IDEAS, { userId: f.ALICE })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.SKILL_ARCHIVE_CONFIRMATION_REQUIRED,
      usedBy: [expect.objectContaining({ featureType: 'subject_generation' })],
    });
    expect(stored('skills', 'skillId', SUBJECT_IDEAS).status).toBe('ACTIVE');

    const { warnings } = await skillService.archiveSkill(SUBJECT_IDEAS, {
      confirmUsedBy: true,
      userId: f.ALICE,
    });

    expect(warnings).toEqual([LOST]);
    expect(stored('skills', 'skillId', SUBJECT_IDEAS)).toMatchObject({
      status: 'ARCHIVED',
      usageHistory: [expect.objectContaining({ change: 'archived' })],
    });
  });

  it('archives a skill no feature calls at once, with nothing to keep', async () => {
    const { warnings } = await skillService.archiveSkill(UNRELEASED);

    expect(warnings).toEqual([]);
    expect(stored('skills', 'skillId', UNRELEASED).status).toBe('ARCHIVED');
  });
});
