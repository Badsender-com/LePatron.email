'use strict';

// The required tracking parameters are a check like the others (epic #1193,
// ADR 0009): blocking by default, the server keeps refusing a download or an
// ESP send that misses one; when the group or the template turns that check
// off, or only on, the server no longer blocks on it, and the other tracking
// parameters still go on the links.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Groups: { findById: jest.fn() },
  Mailings: {},
  Templates: {},
}));

const mailingService = require('../../../packages/server/mailing/mailing.service.js');

const trackingCheck = (state) => ({ checks: { 'tracking-params': { state } } });

const GROUP_ID = '507f1f77bcf86cd799439001';
const trackingConfig = {
  enabled: true,
  params: [
    { key: 'utm_campaign', required: true, values: [] },
    { key: 'utm_source', values: [] },
  ],
};

function mailingWith(templateSettings) {
  return {
    _doc: {
      data: {
        tracking: {
          trackingUrls: [{ key: 'utm_source', value: 'newsletter' }],
        },
      },
    },
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

describe('the server re-check of the required tracking parameters', () => {
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

  it.each(['off', 'on'])(
    'lets it through when the template sets the check %s while the company keeps it blocking',
    async (state) => {
      const error = await rejection(
        mailingService.resolveMailingTrackingContext(
          mailingWith(trackingCheck(state)),
          undefined,
          groupWith(trackingCheck('blocking'))
        )
      );
      expect(error).toBeNull();
    }
  );

  it('still puts the other parameters on the links when nothing blocks', async () => {
    const context = await mailingService.resolveMailingTrackingContext(
      mailingWith(),
      undefined,
      groupWith(trackingCheck('off'))
    );
    expect(context.groupTrackingConfig.params).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'utm_source' })])
    );
    const { html } = mailingService.handleTrackingData({
      html: '<a href="https://brand.test/shop">Shop</a>',
      ...context,
    });
    expect(html).toContain('utm_source=newsletter');
    expect(html).not.toContain('utm_campaign=');
  });
});
