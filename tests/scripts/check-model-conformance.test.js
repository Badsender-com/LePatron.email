'use strict';

const {
  familyOf,
  selectModels,
  estimateCalls,
} = require('../../scripts/model-conformance/plan');
const {
  formatReport,
  exitCodeFor,
  VERDICTS,
} = require('../../scripts/model-conformance/report');

describe('familyOf', () => {
  // The distinction that mattered: gpt-5 and gpt-6 do not share a contract.
  it('separates generations', () => {
    expect(familyOf('gpt-6-astra')).not.toBe(familyOf('gpt-5-mini'));
  });

  it.each([
    ['gpt-4o-2024-08-06', 'gpt-4o'],
    ['gpt-4o', 'gpt-4o'],
    ['gpt-6-astra', 'gpt-6'],
    ['gemini-flash-latest', 'gemini-flash'],
    ['claude-haiku-4-5-20251001', 'claude-haiku'],
    ['mistral-small-latest', 'mistral-small'],
    ['o3-mini', 'o3'],
  ])('groups %s under %s', (id, expected) => {
    expect(familyOf(id)).toBe(expected);
  });

  it('survives an empty id', () => {
    expect(familyOf('')).toBe('');
    expect(familyOf(undefined)).toBe('');
  });
});

describe('selectModels', () => {
  const catalogIds = ['gpt-5-mini', 'gpt-4o'];
  const configuredIds = ['gpt-4.1-mini'];
  const listedIds = [
    'gpt-5-mini',
    'gpt-5',
    'gpt-4o',
    'gpt-4o-2024-08-06',
    'gpt-6-astra',
    'gpt-6-luna',
    'gpt-6-sol',
  ];

  it('always keeps the catalogue and what groups configured', () => {
    const picked = selectModels({ catalogIds, configuredIds, listedIds });

    for (const id of [...catalogIds, ...configuredIds]) {
      expect(picked).toContain(id);
    }
  });

  // The point of the family sampling: an unknown contract must be reached.
  it('reaches a family the catalogue never heard of', () => {
    const picked = selectModels({ catalogIds, configuredIds, listedIds });

    expect(picked.some((id) => id.startsWith('gpt-6'))).toBe(true);
  });

  it('probes one variant per family, not all three', () => {
    const picked = selectModels({ catalogIds, configuredIds, listedIds });

    expect(picked.filter((id) => id.startsWith('gpt-6'))).toHaveLength(1);
  });

  it('is deterministic, so two runs compare', () => {
    const a = selectModels({ catalogIds, configuredIds, listedIds });
    const b = selectModels({ catalogIds, configuredIds, listedIds });

    expect(a).toEqual(b);
  });

  it('takes everything listed when asked', () => {
    const picked = selectModels({
      catalogIds,
      configuredIds,
      listedIds,
      all: true,
    });

    expect(picked.filter((id) => id.startsWith('gpt-6'))).toHaveLength(3);
  });

  it('honours an explicit list above everything else', () => {
    expect(
      selectModels({
        catalogIds,
        configuredIds,
        listedIds,
        only: ['gpt-6-astra'],
      })
    ).toEqual(['gpt-6-astra']);
  });

  it('never returns a duplicate', () => {
    const picked = selectModels({
      catalogIds: ['gpt-4o'],
      configuredIds: ['gpt-4o'],
      listedIds: ['gpt-4o'],
    });

    expect(picked).toEqual(['gpt-4o']);
  });
});

describe('estimateCalls', () => {
  // Shown before anything is spent.
  it('counts probes across both paths', () => {
    expect(estimateCalls([{ models: ['a', 'b'] }, { models: ['c'] }], 2)).toBe(
      6
    );
  });

  it('multiplies by the sample count', () => {
    expect(estimateCalls([{ models: ['a'] }], 2, 3)).toBe(6);
  });
});

describe('exitCodeFor', () => {
  const probe = (verdict) => ({
    provider: 'openai',
    integrationId: 'abc123',
    model: 'm',
    path: 'skill',
    verdict,
  });

  it('is 0 when everything passed', () => {
    expect(exitCodeFor([probe(VERDICTS.OK)])).toBe(0);
  });

  it('is 1 on a structural refusal', () => {
    expect(exitCodeFor([probe(VERDICTS.OK), probe(VERDICTS.FAIL)])).toBe(1);
  });

  // Adapted means it worked, but at the cost of a refused request — a signal,
  // not a success.
  it.each([
    [VERDICTS.ADAPTED],
    [VERDICTS.FLAKY],
    [VERDICTS.TRANSIENT],
    [VERDICTS.SKIPPED],
  ])('is 2 on %s alone', (verdict) => {
    expect(exitCodeFor([probe(VERDICTS.OK), probe(verdict)])).toBe(2);
  });

  it('prefers the failure when both are present', () => {
    expect(exitCodeFor([probe(VERDICTS.ADAPTED), probe(VERDICTS.FAIL)])).toBe(
      1
    );
  });
});

describe('formatReport', () => {
  const results = [
    {
      provider: 'openai',
      integrationId: '65f1aaaa1c9',
      model: 'gpt-5-mini',
      path: 'skill',
      verdict: VERDICTS.OK,
    },
    {
      provider: 'openai',
      integrationId: '65f1aaaa1c9',
      model: 'gpt-6-astra',
      path: 'translation',
      verdict: VERDICTS.ADAPTED,
      detail: 'rename max_tokens; drop temperature',
    },
    {
      provider: 'openai',
      integrationId: '65f1aaaa1c9',
      model: 'gpt-6-sol',
      path: 'skill',
      verdict: VERDICTS.FAIL,
      detail: '400 unsupported_parameter param=reasoning_effort',
    },
  ];

  it('lists every probe with its verdict', () => {
    const report = formatReport(results);

    expect(report).toContain('gpt-5-mini');
    expect(report).toContain('ADAPTED');
    expect(report).toContain('rename max_tokens; drop temperature');
  });

  it('calls out failures in the summary', () => {
    expect(formatReport(results)).toContain('✗ openai/gpt-6-sol');
  });

  it('flags adaptations as something to act on', () => {
    expect(formatReport(results)).toMatch(/adaptation/i);
  });

  // Two runs of the same set must produce the same bytes, or the diff is
  // worthless.
  it('is stable across runs and input order', () => {
    const shuffled = [results[2], results[0], results[1]];

    expect(formatReport(shuffled)).toBe(formatReport(results));
  });

  it('never prints a full integration id', () => {
    expect(formatReport(results)).not.toContain('65f1aaaa1c9');
  });
});

// Classifying the failure is what keeps the report readable: a sweep that
// reports every refusal as FAIL is one nobody reads twice.
describe('error classification', () => {
  const {
    isTransient,
    isUnentitled,
  } = require('../../scripts/model-conformance/probe');

  it.each([
    [
      'PROVIDER_INVALID_CREDENTIALS code',
      { code: 'PROVIDER_INVALID_CREDENTIALS' },
    ],
    // Mistral answers 403 for a model outside the subscription, not 401.
    [
      'a 403 on a model the plan excludes',
      { message: 'Mistral API error: 403 not entitled' },
    ],
    ['a 401', { message: 'API error: 401 unauthorized' }],
  ])('skips %s', (_label, error) => {
    expect(isUnentitled(error)).toBe(true);
  });

  it.each([
    [
      'a refused parameter',
      { message: "400 Unsupported parameter: 'max_tokens'" },
    ],
    ['nothing at all', null],
    // The digits must stand alone: a model id is not a status.
    ['a model id that contains 403', { message: 'model glm-403b failed' }],
  ])('does not skip %s', (_label, error) => {
    expect(isUnentitled(error)).toBe(false);
  });

  it('separates the transient class from the entitlement one', () => {
    const rateLimited = { message: 'API error: 429 rate limited' };
    expect(isTransient(rateLimited)).toBe(true);
    expect(isUnentitled(rateLimited)).toBe(false);
  });
});
