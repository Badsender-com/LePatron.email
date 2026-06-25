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

    it('injects a free-form key that is a substring of an existing param name', () => {
      // Regression: link.includes('utm') matched '?utm_source=' and wrongly
      // dropped a legitimate free-form 'utm' param.
      const out = getUrlWithTrackingParams(
        'https://x.com?utm_source=x',
        { trackingUrls: [{ key: 'utm', value: 'v' }] },
        null
      );
      expect(out).toBe('https://x.com?utm_source=x&utm=v');
    });

    it('injects a free-form key that is a substring of the host/scheme', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'https', value: 'v' }] },
        null
      );
      expect(out).toBe('https://x.com?https=v');
    });

    it('still skips a free-form key already present as a real query param', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com?ref=old',
        { trackingUrls: [{ key: 'ref', value: 'new' }] },
        null
      );
      expect(out).toBe('https://x.com?ref=old');
    });

    it('dedups two free-form rows with the same key — last value wins', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        {
          trackingUrls: [
            { key: 'ref', value: 'first' },
            { key: 'ref', value: 'last' },
          ],
        },
        null
      );
      expect(out).toBe('https://x.com?ref=last');
    });

    it('keeps distinct free-form keys in order', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        {
          trackingUrls: [
            { key: 'a', value: '1' },
            { key: 'b', value: '2' },
          ],
        },
        null
      );
      expect(out).toBe('https://x.com?a=1&b=2');
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

    it('ignores the GA UTM fields entirely in managed mode (not rendered in the editor)', () => {
      // groupConfig.params is non-empty → managed mode. The GA UTM helper
      // fields have no editor UI there, so they must not be injected even when
      // a key matches a managed key.
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
      expect(out).toBe('https://x.com');
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

    it('keeps the user-picked value for a locked param with multiple allowed values', () => {
      // Locked + multiple values is a strict combobox in the editor: the user
      // PICKS from the list. The chosen in-list value must survive export
      // (regression: it used to be overwritten by the first allowed value).
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: 'adobe' }] },
        {
          enabled: true,
          params: [
            {
              key: 'utm_source',
              values: ['newsletter', 'adobe', 'trigger'],
              lockedValues: true,
            },
          ],
        }
      );
      expect(out).toBe('https://x.com?utm_source=adobe');
    });

    it('falls back to the first allowed value when a locked multi-value pick is out of list', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: 'forged' }] },
        {
          enabled: true,
          params: [
            {
              key: 'utm_source',
              values: ['newsletter', 'adobe', 'trigger'],
              lockedValues: true,
            },
          ],
        }
      );
      expect(out).toBe('https://x.com?utm_source=newsletter');
    });

    it('ignores stale Google-Analytics UTM fields in managed mode (ghost values)', () => {
      // The GA UTM helper fields are only editable in legacy mode. In managed
      // mode they are invisible in the editor and must not leak into export,
      // even when a value lingers from a pre-config state.
      const out = getUrlWithTrackingParams(
        'https://x.com',
        {
          trackingUrls: [{ key: 'utm_source', value: 'adobe' }],
          hasGoogleAnalyticsUtm: true,
          utmSourceKey: 'utm_source',
          utmSourceValue: 'ghost',
          utmMediumKey: 'utm_medium',
          utmMediumValue: 'ghost_medium',
        },
        {
          enabled: true,
          params: [
            {
              key: 'utm_source',
              values: ['newsletter', 'adobe'],
              lockedValues: true,
            },
          ],
        }
      );
      // utm_source keeps the managed pick (not the GA ghost), and the GA-only
      // utm_medium is dropped entirely.
      expect(out).toBe('https://x.com?utm_source=adobe');
    });

    it('still applies Google-Analytics UTM fields in legacy mode (no group config)', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        {
          hasGoogleAnalyticsUtm: true,
          utmSourceKey: 'utm_source',
          utmSourceValue: 'news',
        },
        { enabled: false, params: [] }
      );
      expect(out).toBe('https://x.com?utm_source=news');
    });

    it('accepts a custom value when the list is a suggestion (not locked, not restricted)', () => {
      // An allowed list alone is just a suggestion: a value outside it must
      // still be injected. This mirrors the editor combobox (pick OR type).
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: 'custom' }] },
        {
          enabled: true,
          params: [{ key: 'utm_source', values: ['a', 'b'] }],
        }
      );
      expect(out).toBe('https://x.com?utm_source=custom');
    });

    it('drops a value outside the list only when restrictValues is on', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: 'forged' }] },
        {
          enabled: true,
          restrictValues: true,
          params: [{ key: 'utm_source', values: ['a', 'b'] }],
        }
      );
      expect(out).toBe('https://x.com');
    });

    it('keeps a value inside the list when restrictValues is on', () => {
      const out = getUrlWithTrackingParams(
        'https://x.com',
        { trackingUrls: [{ key: 'utm_source', value: 'b' }] },
        {
          enabled: true,
          restrictValues: true,
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
