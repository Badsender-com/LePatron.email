/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// GET /api/ai-expertise, searched on the server: what the query string says
// reaches the query as a value of its kind, or is refused.

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

let count = 0;
const expertise = (expertiseId, title, status = 'ACTIVE') => ({
  _id: `507f1f77bcf86cd7994398${String((count += 1)).padStart(2, '0')}`,
  expertiseId,
  title,
  status,
  category: 'qc',
});

beforeEach(() =>
  mockStore.seed({
    expertises: [
      expertise('qc.cta', 'Bouton (CTA) visible'),
      expertise('qc.cta-draft', 'Bouton en test', 'DRAFT'),
      expertise('qcxcta', 'Autre chose'),
    ],
  })
);

const listed = async (query) => {
  const res = await request(aiSkillApp()).get(`/api/ai-expertise?${query}`);
  return {
    status: res.status,
    body: res.body,
    ids: (res.body.items || []).map((item) => item.expertiseId).sort(),
  };
};

describe('GET /api/ai-expertise', () => {
  it('searches as written, whatever the case, with the status', async () => {
    expect((await listed('search=QC.CTA')).ids).toEqual([
      'qc.cta',
      'qc.cta-draft',
    ]);
    expect((await listed('search=qc.cta&status=DRAFT')).ids).toEqual([
      'qc.cta-draft',
    ]);
  });

  it('reads the expertises named by ids, one or several', async () => {
    expect((await listed('ids=qc.cta-draft')).ids).toEqual(['qc.cta-draft']);
    expect((await listed('ids=qc.cta&ids=qcxcta')).ids).toEqual([
      'qc.cta',
      'qcxcta',
    ]);
  });

  it.each([
    ['search[$regex]=.*', 'EXPERTISE_SEARCH_INVALID'],
    [`search=${'a'.repeat(101)}`, 'EXPERTISE_SEARCH_INVALID'],
    ['ids[$ne]=x', 'EXPERTISE_IDS_INVALID'],
    [
      Array.from({ length: 21 }, (_, i) => `ids=qc.e${i}`).join('&'),
      'EXPERTISE_IDS_INVALID',
    ],
    ['status[$ne]=ARCHIVED', 'EXPERTISE_LIST_FILTER_INVALID'],
  ])('refuses ?%s', async (query, code) => {
    const { status, body } = await listed(query);

    expect(status).toBe(400);
    expect(body.message).toBe(code);
  });
});
