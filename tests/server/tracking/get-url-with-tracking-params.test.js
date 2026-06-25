'use strict';

const {
  getUrlWithTrackingParams,
} = require('../../../packages/server/utils/download-zip-markdown.js');

describe('getUrlWithTrackingParams', () => {
  describe('legacy behaviour (no group config)', () => {
    it('returns the link as-is when nothing to add', () => {
      expect(getUrlWithTrackingParams('https://x.com', null, null)).toBe(
        'https://x.com'
      );
      expect(
        getUrlWithTrackingParams('https://x.com', { trackingUrls: [] }, null)
      ).toBe('https://x.com');
    });

    it('appends a single tracking param when missing', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: 'news' }] },
        null
      );
      expect(out).toBe('https://x.com?utm_source=news');
    });

    it('uses & when the URL already has a query string', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com?lang=fr',
        { trackingUrls: [{ key: 'utm_source', value: 'news' }] },
        null
      );
      expect(out).toBe('https://x.com?lang=fr&utm_source=news');
    });

    it('skips params already present (legacy)', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com?utm_source=existing',
        { trackingUrls: [{ key: 'utm_source', value: 'news' }] },
        null
      );
      expect(out).toBe('https://x.com?utm_source=existing');
    });

    it('appends Google Analytics UTM fields when enabled', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        {
          hasGoogleAnalyticsUtm: true,
          utmSourceKey: 'utm_source',
          utmSourceValue: 'news',
          utmMediumKey: 'utm_medium',
          utmMediumValue: 'email',
          utmCampaignKey: 'utm_campaign',
          utmCampaignValue: 'promo',
        },
        null
      );
      expect(out).toBe(
        'https://x.com?utm_source=news&utm_medium=email&utm_campaign=promo'
      );
    });

    it('ignores entries with empty key or value', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        {
          trackingUrls: [
            { key: '', value: 'x' },
            { key: 'utm_source', value: '' },
            { key: 'utm_medium', value: 'email' },
          ],
        },
        null
      );
      expect(out).toBe('https://x.com?utm_medium=email');
    });
  });

  describe('group config priority inversion', () => {
    const groupConfig = {
      enabled: true,
      params: [{ key: 'utm_source' }, { key: 'utm_medium' }],
    };

    it('overrides a param already present in the link with the user value', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com?utm_source=stale&keep=1',
        { trackingUrls: [{ key: 'utm_source', value: 'newsletter' }] },
        groupConfig
      );
      expect(out).toBe('https://x.com?utm_source=newsletter&keep=1');
    });

    it('inserts the param when not present', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: 'newsletter' }] },
        groupConfig
      );
      expect(out).toBe('https://x.com?utm_source=newsletter');
    });

    it('overrides multiple group keys in the same link', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com?utm_source=stale&utm_medium=stale&keep=1',
        {
          trackingUrls: [
            { key: 'utm_source', value: 'newsletter' },
            { key: 'utm_medium', value: 'email' },
          ],
        },
        groupConfig
      );
      expect(out).toBe(
        'https://x.com?utm_source=newsletter&utm_medium=email&keep=1'
      );
    });

    it('keeps legacy "skip if present" behaviour for non-group free-form params', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com?utm_other=stale',
        {
          trackingUrls: [
            { key: 'utm_other', value: 'new' }, // free-form, NOT in groupConfig
          ],
        },
        groupConfig
      );
      expect(out).toBe('https://x.com?utm_other=stale');
    });

    it('appends free-form params when not already present in the link', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com?utm_source=stale',
        {
          trackingUrls: [
            { key: 'utm_source', value: 'newsletter' }, // group → override
            { key: 'custom', value: 'value' }, // free-form → append
          ],
        },
        groupConfig
      );
      expect(out).toBe('https://x.com?utm_source=newsletter&custom=value');
    });
  });

  describe('restrictValues', () => {
    const groupConfig = {
      enabled: true,
      restrictValues: true,
      params: [{ key: 'utm_source' }],
    };

    it('drops free-form params not in the group whitelist', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        {
          trackingUrls: [
            { key: 'utm_source', value: 'newsletter' },
            { key: 'custom', value: 'value' },
          ],
        },
        groupConfig
      );
      expect(out).toBe('https://x.com?utm_source=newsletter');
    });

    it('drops UTM fields not in the whitelist when restrictValues is on', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        {
          hasGoogleAnalyticsUtm: true,
          utmSourceKey: 'utm_source',
          utmSourceValue: 'news',
          utmMediumKey: 'utm_medium',
          utmMediumValue: 'email',
        },
        groupConfig
      );
      expect(out).toBe('https://x.com?utm_source=news');
    });
  });

  describe('edge cases', () => {
    it('handles disabled group config gracefully (legacy behaviour)', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com?utm_source=stale',
        { trackingUrls: [{ key: 'utm_source', value: 'newsletter' }] },
        { enabled: false, params: [{ key: 'utm_source' }] }
      );
      // not enabled → no override → legacy skip-if-present applies
      expect(out).toBe('https://x.com?utm_source=stale');
    });

    it('does not touch other params when replacing', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com?a=1&utm_source=stale&b=2#fragment',
        { trackingUrls: [{ key: 'utm_source', value: 'news' }] },
        { enabled: true, params: [{ key: 'utm_source' }] }
      );
      expect(out).toBe('https://x.com?a=1&utm_source=news&b=2#fragment');
    });
  });

  describe('encoding / injection safety', () => {
    it('escapes a double quote so the value cannot break out of href', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        {
          trackingUrls: [
            { key: 'utm_source', value: 'x" onmouseover="alert(1)' },
          ],
        },
        null
      );
      expect(out).not.toContain('"');
      expect(out).toBe(
        'https://x.com?utm_source=x%22%20onmouseover=%22alert(1)'
      );
    });

    it('escapes < and > to prevent markup injection', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: '<script>' }] },
        null
      );
      expect(out).toBe('https://x.com?utm_source=%3Cscript%3E');
    });

    it('escapes & so a value cannot forge extra query params', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: 'a&admin=1' }] },
        null
      );
      expect(out).toBe('https://x.com?utm_source=a%26admin=1');
    });

    it('escapes # so a value cannot truncate the URL with a fragment', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: 'a#frag' }] },
        null
      );
      expect(out).toBe('https://x.com?utm_source=a%23frag');
    });

    it('preserves personalization placeholders ({{token}})', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: '{{contact.id}}' }] },
        null
      );
      expect(out).toBe('https://x.com?utm_source={{contact.id}}');
    });

    it('encodes free-form param values too', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'ref', value: 'a"b' }] },
        null
      );
      expect(out).toBe('https://x.com?ref=a%22b');
    });
  });

  describe('server-side value enforcement (lockedValues / allowed list)', () => {
    it('forces the configured value when lockedValues is set, ignoring the client value', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: 'forged' }] },
        {
          enabled: true,
          params: [
            { key: 'utm_source', values: ['official'], lockedValues: true },
          ],
        }
      );
      expect(out).toBe('https://x.com?utm_source=official');
    });

    it('drops a managed value not in the allowed list (restricted, not locked)', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: 'forged' }] },
        {
          enabled: true,
          params: [{ key: 'utm_source', values: ['a', 'b'] }],
        }
      );
      // forged value is not injected
      expect(out).toBe('https://x.com');
    });

    it('keeps a managed value that IS in the allowed list', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: 'b' }] },
        {
          enabled: true,
          params: [{ key: 'utm_source', values: ['a', 'b'] }],
        }
      );
      expect(out).toBe('https://x.com?utm_source=b');
    });

    it('accepts any value for a managed key with no allowed list and not locked', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: 'anything' }] },
        { enabled: true, params: [{ key: 'utm_source', values: [] }] }
      );
      expect(out).toBe('https://x.com?utm_source=anything');
    });
  });
});
