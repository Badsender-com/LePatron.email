'use strict';

// The required tracking parameters are a check like the others (epic #1193,
// ADR 0004): blocking by default, the server keeps refusing a download or an
// ESP send that misses one; when the group or the template turns that check
// off, or only on, the server no longer blocks on it.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Groups: { findById: jest.fn() },
  Mailings: {},
  Templates: {},
}));

const mailingService = require('../../../packages/server/mailing/mailing.service.js');

const GROUP_ID = '507f1f77bcf86cd799439001';
const trackingConfig = {
  enabled: true,
  params: [{ key: 'utm_campaign', required: true, values: [] }],
};

function mailingWith(templateSettings) {
  return {
    _doc: { data: { tracking: { trackingUrls: [] } } },
    _company: GROUP_ID,
    _wireframe: {
      _company: GROUP_ID,
      ...(templateSettings ? { qualitySettings: templateSettings } : {}),
    },
  };
}

const groupWith = (qualitySettings) => ({
  _id: GROUP_ID,
  trackingConfig,
  ...(qualitySettings ? { qualitySettings } : {}),
});

const rejection = (promise) =>
  promise.then(
    () => null,
    (error) => error
  );

// Turned on by #1202 (the required tracking parameters as a check like the others)
describe.skip('the server re-check of the required tracking parameters', () => {
  it('refuses a missing required parameter by default, as today', async () => {
    const error = await rejection(
      mailingService.resolveMailingTrackingContext(
        mailingWith(),
        undefined,
        groupWith()
      )
    );
    expect(error.message).toBe('TRACKING_REQUIRED_PARAMS_MISSING');
  });

  it.each(['off', 'on'])(
    'lets it through when the group set the check %s',
    async (state) => {
      const error = await rejection(
        mailingService.resolveMailingTrackingContext(
          mailingWith(),
          undefined,
          groupWith({ checks: { 'tracking-params': { state } } })
        )
      );
      expect(error).toBeNull();
    }
  );

  it("follows the template's override over the group's", async () => {
    const error = await rejection(
      mailingService.resolveMailingTrackingContext(
        mailingWith({ checks: { 'tracking-params': { state: 'blocking' } } }),
        undefined,
        groupWith({ checks: { 'tracking-params': { state: 'off' } } })
      )
    );
    expect(error.message).toBe('TRACKING_REQUIRED_PARAMS_MISSING');
  });
});
