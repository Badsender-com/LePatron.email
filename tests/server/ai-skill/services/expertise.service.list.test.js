/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The expertise list of the back office, searched on the server: a search in
// the title and the id, taken as written, and a few expertises read by id
// whatever their status.

jest.mock('../../../../packages/server/common/models.common', () => {
  const { createMcpStore } = require('../../../helpers/mcp-fake-models.js');
  const store = createMcpStore();
  return { ...store.models, mockStore: store };
});

const {
  listExpertise,
} = require('../../../../packages/server/ai-skill/services/expertise.service.js');
const {
  MAX_SEARCH_LENGTH,
  MAX_LISTED_IDS,
} = require('../../../../packages/server/ai-skill/services/expertise-list-filter.js');
const {
  mockStore,
} = require('../../../../packages/server/common/models.common');

let count = 0;
const expertise = (expertiseId, title, status = 'ACTIVE') => ({
  _id: `507f1f77bcf86cd7994398${String((count += 1)).padStart(2, '0')}`,
  expertiseId,
  title,
  status,
  category: 'qc',
  updatedAt: new Date(Date.UTC(2026, 0, count)),
});

beforeEach(() =>
  mockStore.seed({
    expertises: [
      expertise('brand.tone', 'Ton de la marque'),
      expertise('qc.cta', 'Bouton (CTA) visible'),
      expertise('qc.cta-draft', 'Bouton en test', 'DRAFT'),
      expertise('qcxcta', 'Autre chose'),
    ],
  })
);

const idsOf = async (filters) =>
  (await listExpertise(filters)).items.map((item) => item.expertiseId).sort();

describe('listExpertise, searched', () => {
  it.each(['cta', 'CTA', 'Cta'])(
    'finds "%s" in the title or the id, whatever the case',
    async (search) => {
      expect(await idsOf({ search })).toEqual([
        'qc.cta',
        'qc.cta-draft',
        'qcxcta',
      ]);
    }
  );

  it('takes the search as written, never as a pattern', async () => {
    expect(await idsOf({ search: 'qc.cta' })).toEqual([
      'qc.cta',
      'qc.cta-draft',
    ]);
    expect(await idsOf({ search: '(CTA)' })).toEqual(['qc.cta']);
    expect(await idsOf({ search: '.*' })).toEqual([]);
  });

  it('combines the search with the status', async () => {
    expect(await idsOf({ search: 'bouton', status: 'ACTIVE' })).toEqual([
      'qc.cta',
    ]);
  });

  it('lists everything for a blank search', async () => {
    expect(await idsOf({ search: '   ' })).toHaveLength(4);
  });

  it(`refuses a search longer than ${MAX_SEARCH_LENGTH} characters`, async () => {
    await expect(
      listExpertise({ search: 'a'.repeat(MAX_SEARCH_LENGTH + 1) })
    ).rejects.toMatchObject({
      status: 400,
      message: 'EXPERTISE_SEARCH_INVALID',
      max: MAX_SEARCH_LENGTH,
    });
    expect(
      await idsOf({ search: `${'a'.repeat(MAX_SEARCH_LENGTH - 3)}cta` })
    ).toEqual([]);
  });

  it.each([
    ['an operator', { $regex: '.*' }],
    ['a list', ['cta', 'tone']],
  ])('refuses %s as a search', async (_case, search) => {
    await expect(listExpertise({ search })).rejects.toMatchObject({
      status: 400,
      message: 'EXPERTISE_SEARCH_INVALID',
    });
  });

  it.each([
    ['status', { status: { $ne: 'ARCHIVED' } }],
    ['status', { status: 'PUBLISHED' }],
    ['category', { category: { $ne: null } }],
  ])('refuses a %s that is not one', async (_field, filters) => {
    await expect(listExpertise(filters)).rejects.toMatchObject({
      status: 400,
      message: 'EXPERTISE_LIST_FILTER_INVALID',
    });
  });
});

describe('listExpertise, by ids', () => {
  it('reads one expertise named alone', async () => {
    expect(await idsOf({ ids: 'qc.cta' })).toEqual(['qc.cta']);
  });

  it('reads the expertises named, whatever their status', async () => {
    expect(await idsOf({ ids: ['qc.cta-draft', 'brand.tone'] })).toEqual([
      'brand.tone',
      'qc.cta-draft',
    ]);
  });

  it('answers none for an id that names no expertise', async () => {
    expect(await idsOf({ ids: ['qc.gone'] })).toEqual([]);
  });

  it(`reads ${MAX_LISTED_IDS} expertises at most`, async () => {
    const ids = Array.from({ length: MAX_LISTED_IDS }, (_, i) => `qc.e${i}`);
    expect(await idsOf({ ids })).toEqual([]);
    await expect(
      listExpertise({ ids: [...ids, 'qc.cta'] })
    ).rejects.toMatchObject({
      status: 400,
      message: 'EXPERTISE_IDS_INVALID',
      max: MAX_LISTED_IDS,
    });
  });

  it.each([
    ['an empty list', []],
    ['an id out of the format', ['Qc CTA']],
    ['an operator', { $ne: null }],
    ['an operator in the list', [{ $ne: null }]],
  ])('refuses %s', async (_case, ids) => {
    await expect(listExpertise({ ids })).rejects.toMatchObject({
      status: 400,
      message: 'EXPERTISE_IDS_INVALID',
    });
  });
});
