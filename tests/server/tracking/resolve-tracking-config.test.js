'use strict';

const {
  resolveTrackingConfig,
  validateRequiredTrackingParams,
} = require('../../../packages/server/utils/resolve-tracking-config.js');

function group(cfg) {
  return { trackingConfig: cfg };
}
function template(cfg) {
  return { trackingConfig: cfg };
}

describe('resolveTrackingConfig', () => {
  it('returns null when neither group nor template have a config', () => {
    expect(resolveTrackingConfig(null, null)).toBeNull();
    expect(resolveTrackingConfig({}, {})).toBeNull();
  });

  it('returns null when both configs exist but are disabled', () => {
    expect(
      resolveTrackingConfig(
        group({ enabled: false, params: [{ key: 'utm_source' }] }),
        template({ enabled: false, params: [{ key: 'utm_medium' }] })
      )
    ).toBeNull();
  });

  it('returns the group config when only the group is enabled', () => {
    const result = resolveTrackingConfig(
      group({
        enabled: true,
        restrictValues: true,
        params: [{ key: 'utm_source', values: ['newsletter'], required: true }],
      }),
      null
    );
    expect(result).toEqual({
      enabled: true,
      restrictValues: true,
      params: [{ key: 'utm_source', values: ['newsletter'], required: true }],
    });
  });

  it('returns the template config when only the template is enabled', () => {
    const result = resolveTrackingConfig(
      null,
      template({
        enabled: true,
        params: [{ key: 'utm_medium', values: [], required: false }],
      })
    );
    expect(result).toMatchObject({
      enabled: true,
      params: [{ key: 'utm_medium' }],
    });
  });

  describe('overrideGroupTracking', () => {
    it('returns template config only, ignoring group', () => {
      const result = resolveTrackingConfig(
        group({
          enabled: true,
          params: [{ key: 'utm_source', values: ['from-group'] }],
        }),
        template({
          overrideGroupTracking: true,
          enabled: true,
          params: [{ key: 'utm_medium', values: ['from-template'] }],
        })
      );
      expect(result.params).toHaveLength(1);
      expect(result.params[0].key).toBe('utm_medium');
    });

    it('preserves the template restrictValues choice in "replace" mode', () => {
      // The two dimensions (override + restrictValues) are independent by
      // design: legitimate workflows include "replace globally but still
      // allow free-form additions". Historical trackingUrls residuals from
      // a previous config are intentionally preserved (cf. resolver doc).
      const result = resolveTrackingConfig(
        group({
          enabled: true,
          params: [{ key: 'utm_source' }, { key: 'utm_medium' }],
        }),
        template({
          overrideGroupTracking: true,
          enabled: true,
          restrictValues: false,
          params: [{ key: 'utm_template_only', required: true }],
        })
      );
      expect(result.restrictValues).toBe(false);
      expect(result.params).toHaveLength(1);
      expect(result.params[0].key).toBe('utm_template_only');
    });

    it('returns null when override is on but template is disabled', () => {
      const result = resolveTrackingConfig(
        group({
          enabled: true,
          params: [{ key: 'utm_source' }],
        }),
        template({
          overrideGroupTracking: true,
          enabled: false,
          params: [],
        })
      );
      expect(result).toBeNull();
    });
  });

  describe('merge mode', () => {
    it('merges template params on top of group params', () => {
      const result = resolveTrackingConfig(
        group({
          enabled: true,
          params: [
            { key: 'utm_source', values: ['newsletter'], required: true },
            { key: 'utm_medium', values: ['email'], required: false },
          ],
        }),
        template({
          enabled: true,
          params: [{ key: 'utm_campaign', values: ['promo'], required: false }],
        })
      );
      expect(result.params.map((p) => p.key)).toEqual([
        'utm_source',
        'utm_medium',
        'utm_campaign',
      ]);
    });

    it('template params override group params with the same key', () => {
      const result = resolveTrackingConfig(
        group({
          enabled: true,
          params: [
            { key: 'utm_source', values: ['newsletter'], required: false },
          ],
        }),
        template({
          enabled: true,
          params: [{ key: 'utm_source', values: ['promo'], required: true }],
        })
      );
      expect(result.params).toHaveLength(1);
      expect(result.params[0].values).toEqual(['promo']);
      expect(result.params[0].required).toBe(true);
    });

    it('OR-combines restrictValues across group and template', () => {
      const r1 = resolveTrackingConfig(
        group({ enabled: true, restrictValues: false, params: [] }),
        template({ enabled: true, restrictValues: true, params: [] })
      );
      expect(r1.restrictValues).toBe(true);

      const r2 = resolveTrackingConfig(
        group({ enabled: true, restrictValues: true, params: [] }),
        template({ enabled: true, restrictValues: false, params: [] })
      );
      expect(r2.restrictValues).toBe(true);
    });
  });

  it('handles Mongoose-like subdocs that expose toObject()', () => {
    const groupDoc = {
      trackingConfig: {
        toObject() {
          return {
            enabled: true,
            params: [{ key: 'utm_source', values: ['x'] }],
          };
        },
      },
    };
    const result = resolveTrackingConfig(groupDoc, null);
    expect(result.params[0].key).toBe('utm_source');
  });
});

describe('validateRequiredTrackingParams', () => {
  const cfg = {
    enabled: true,
    params: [
      { key: 'utm_source', required: true },
      { key: 'utm_medium', required: true },
      { key: 'utm_campaign', required: false },
    ],
  };

  it('returns [] when no config', () => {
    expect(validateRequiredTrackingParams({}, null)).toEqual([]);
  });

  it('returns [] when config is disabled', () => {
    expect(
      validateRequiredTrackingParams({}, { enabled: false, params: [] })
    ).toEqual([]);
  });

  it('returns all required keys when tracking is empty', () => {
    expect(validateRequiredTrackingParams({}, cfg).sort()).toEqual([
      'utm_medium',
      'utm_source',
    ]);
  });

  it('returns only the missing required keys', () => {
    expect(
      validateRequiredTrackingParams(
        {
          trackingUrls: [{ key: 'utm_source', value: 'newsletter' }],
        },
        cfg
      )
    ).toEqual(['utm_medium']);
  });

  it('ignores keys with empty value', () => {
    expect(
      validateRequiredTrackingParams(
        {
          trackingUrls: [
            { key: 'utm_source', value: '' },
            { key: 'utm_medium', value: 'email' },
          ],
        },
        cfg
      )
    ).toEqual(['utm_source']);
  });

  it('returns [] when all required keys are filled', () => {
    expect(
      validateRequiredTrackingParams(
        {
          trackingUrls: [
            { key: 'utm_source', value: 'newsletter' },
            { key: 'utm_medium', value: 'email' },
          ],
        },
        cfg
      )
    ).toEqual([]);
  });

  it('ignores non-required params', () => {
    expect(
      validateRequiredTrackingParams(
        {
          trackingUrls: [
            { key: 'utm_source', value: 'a' },
            { key: 'utm_medium', value: 'b' },
            // utm_campaign missing but not required
          ],
        },
        cfg
      )
    ).toEqual([]);
  });
});
