'use strict';

// The route of the governance context: what it reads of the email, whose
// language the context is written in, and that an email of another company
// stays absent. The context itself is covered by
// tests/server/taxonomy/governance-context*.test.js.

jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  findOneForUser: jest.fn(),
}));
jest.mock(
  '../../../packages/server/taxonomy/services/governance-context.service.js',
  () => ({ buildGovernanceContext: jest.fn() })
);

const { NotFound } = require('http-errors');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const {
  buildGovernanceContext,
} = require('../../../packages/server/taxonomy/services/governance-context.service.js');
const controller = require('../../../packages/server/mailing/governance-context.controller.js');

const MAILING_ID = '507f1f77bcf86cd799439001';
const user = { id: 'user-1', lang: 'en', group: { id: 'company-a' } };

async function callRoute() {
  const res = { json: jest.fn() };
  const next = jest.fn();
  await controller.readGovernanceContext(
    { params: { mailingId: MAILING_ID }, user },
    res,
    next
  );
  return { res, next };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('GET /mailings/:mailingId/governance-context', () => {
  it('reads the email through the company-scoped lookup, without its content', async () => {
    mailingService.findOneForUser.mockResolvedValue({ _company: 'company-a' });
    buildGovernanceContext.mockResolvedValue({});

    await callRoute();

    expect(mailingService.findOneForUser).toHaveBeenCalledWith(
      MAILING_ID,
      user,
      { _company: 1, _emailType: 1, trigger: 1, _taxonomyItems: 1 }
    );
  });

  it('writes the context in the language of the user asking', async () => {
    const mailing = { _company: 'company-a', trigger: 'adhoc' };
    const context = { dimensions: [], missing: [], text: '' };
    mailingService.findOneForUser.mockResolvedValue(mailing);
    buildGovernanceContext.mockResolvedValue(context);

    const { res } = await callRoute();

    expect(buildGovernanceContext).toHaveBeenCalledWith({
      mailing,
      lang: 'en',
    });
    expect(res.json).toHaveBeenCalledWith(context);
  });

  it('answers 404 for an email of another company, and builds nothing', async () => {
    const notFound = new NotFound('MAILING_NOT_FOUND');
    mailingService.findOneForUser.mockRejectedValue(notFound);

    const { res, next } = await callRoute();

    expect(next).toHaveBeenCalledWith(notFound);
    expect(next.mock.calls[0][0].status).toBe(404);
    expect(buildGovernanceContext).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
