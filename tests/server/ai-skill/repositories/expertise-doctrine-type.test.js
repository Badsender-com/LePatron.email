'use strict';

// The expertises an email loads, by the doctrine type of its email type (epic
// #1631, ADR-0030). An email whose type maps onto nothing asks for the
// expertises targeting no type: advice written for transactional emails must
// not reach an email nobody classified.

jest.mock('../../../../packages/server/common/models.common', () => ({
  Expertises: { find: jest.fn(), distinct: jest.fn() },
}));
jest.mock('../../../../packages/server/utils/logger.js', () => ({
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
}));

const {
  findApplicable,
} = require('../../../../packages/server/ai-skill/repositories/expertise.repository');
const {
  Expertises,
} = require('../../../../packages/server/common/models.common');

// What the database would answer to the query the repository builds, over a
// small set of expertises: one per targeting.
const expertise = (expertiseId, appliesToEmailTypes) => ({
  expertiseId,
  scope: ['redaction'],
  appliesToEmailTypes,
  activeVersion: { major: 1, minor: 0 },
  versions: [{ versionMajor: 1, versionMinor: 0, body: expertiseId }],
});
const EXPERTISES = [
  expertise('any', []),
  expertise('editorial-only', ['editorial']),
  expertise('transactional-only', ['transactional']),
];

// A small evaluator of the clauses the repository writes on
// `appliesToEmailTypes`: the value itself, or an empty list.
const matchesClause = (condition, doc) =>
  condition && condition.$size === 0
    ? doc.appliesToEmailTypes.length === 0
    : doc.appliesToEmailTypes.includes(condition);

const matchesEmailType = (query, doc) =>
  (query.$and || []).every((part) => {
    if ('appliesToEmailTypes' in part) {
      return matchesClause(part.appliesToEmailTypes, doc);
    }
    const ors = (part.$or || []).filter((or) => 'appliesToEmailTypes' in or);
    if (!ors.length) return true;
    return ors.some((or) => matchesClause(or.appliesToEmailTypes, doc));
  });

const loaded = async (filter) => {
  Expertises.find.mockImplementation((query) => ({
    lean: () =>
      Promise.resolve(EXPERTISES.filter((doc) => matchesEmailType(query, doc))),
  }));
  Expertises.distinct.mockResolvedValue(['redaction']);
  const found = await findApplicable({
    scope: ['redaction'],
    categories: ['writing'],
    ...filter,
  });
  return found.map((expertise) => expertise.expertiseId).sort();
};

// Turned on by #1634 (the AI reads the doctrine type of an email type)
describe('expertises filtered by the doctrine type', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the expertises of the doctrine type and those targeting none', async () => {
    expect(await loaded({ emailType: 'editorial' })).toEqual([
      'any',
      'editorial-only',
    ]);
  });

  it('loads only the expertises targeting no type for an email mapped onto none', async () => {
    expect(await loaded({ untargetedOnly: true })).toEqual(['any']);
  });

  it('still loads every expertise when the caller says nothing of an email type, a null one included', async () => {
    // A stray `|| null` must not turn into a filter.
    expect(await loaded({ emailType: null })).toHaveLength(3);
    expect(await loaded({})).toEqual([
      'any',
      'editorial-only',
      'transactional-only',
    ]);
  });
});
