'use strict';

// Duplicate + translate answers who may do it before it starts: the source
// the user may read, the location of the copy one it may write in (the one it
// chose, or the source's own). A refusal is the answer to the request itself,
// before any job, and before the provider translates anything.

const {
  translationJobs,
  mailingService,
  resetMocks,
} = require('./duplicate-translate.harness.js');
const { Forbidden } = require('http-errors');
const ProviderFactory = require('../../../packages/server/integration-providers/provider-factory');
const controller = require('../../../packages/server/translation/translation.controller.js');

const user = { id: 'user', group: { id: 'group' } };

function request(body = {}) {
  return new Promise((resolve) => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(() => resolve({ status: res.status.mock.calls[0][0] })),
    };
    controller.duplicateAndTranslate(
      {
        user,
        params: { mailingId: 'source' },
        body: { targetLanguage: 'en', sourceLanguage: 'fr', ...body },
      },
      res,
      (err) => resolve({ status: err.status })
    );
  });
}

beforeEach(() => {
  resetMocks();
  mailingService.findOneForUser.mockResolvedValue({ name: 'Source' });
});

it('checks the source and the location of the copy before starting', async () => {
  mailingService.assertCanDuplicateWithTranslation.mockResolvedValue();

  const result = await request({ workspaceId: 'w1' });

  expect(result.status).toBe(202);
  expect(mailingService.assertCanDuplicateWithTranslation).toHaveBeenCalledWith(
    {
      mailingId: 'source',
      user,
      workspaceId: 'w1',
      folderId: undefined,
    }
  );
});

it('answers a refusal before any job or translation', async () => {
  mailingService.assertCanDuplicateWithTranslation.mockRejectedValue(
    new Forbidden()
  );

  const result = await request();

  expect(result.status).toBe(403);
  expect(translationJobs.createJob).not.toHaveBeenCalled();
  expect(mailingService.findOneForUser).not.toHaveBeenCalled();
  expect(ProviderFactory.createProvider).not.toHaveBeenCalled();
});
