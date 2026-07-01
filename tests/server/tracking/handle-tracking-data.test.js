'use strict';

const {
  handleTrackingData,
} = require('../../../packages/server/mailing/mailing.service.js');

// `handleTrackingData` is the gateway used by every export path (ZIP download,
// Brevo/DSC/Actito via processHtmlWithFTPOption, Adobe direct). It receives
// HTML straight from the browser's outerHTML serializer, which encodes `&` to
// `&amp;` inside attribute values. These tests pin down the entity-handling
// behaviour because a missed decode would cause real-world duplicates in the
// final URLs (e.g. `?utm_medium=stale&...&utm_medium=email`).
describe('handleTrackingData', () => {
  const groupTrackingConfig = {
    enabled: true,
    params: [{ key: 'utm_source' }, { key: 'utm_medium' }],
  };
  const tracking = {
    trackingUrls: [
      { key: 'utm_source', value: 'newsletter' },
      { key: 'utm_medium', value: 'email' },
    ],
  };

  it('replaces an `&amp;`-encoded existing param instead of appending a duplicate', () => {
    const html =
      '<a href="https://example.com/?utm_source=newsletter&amp;utm_medium=email_newsletter&amp;utm_campaign=foo">x</a>';

    const { html: out } = handleTrackingData({
      html,
      tracking,
      groupTrackingConfig,
    });

    expect(out).toContain('utm_medium=email');
    // The old value must be gone, and we must not have appended a duplicate
    expect(out).not.toContain('utm_medium=email_newsletter');
    expect(out.match(/utm_medium=/g)).toHaveLength(1);
    // The unrelated param must be preserved
    expect(out).toContain('utm_campaign=foo');
    // Output must remain HTML-encoded for valid attribute serialisation
    expect(out).toContain('&amp;');
    expect(out).not.toMatch(/[^p]&(?!amp;)/); // every remaining & is &amp;
  });

  it('rewrites a `?key=` first-position param even when followed by `&amp;`', () => {
    const html =
      '<a href="https://example.com/?utm_source=stale&amp;keep=1">x</a>';

    const { html: out } = handleTrackingData({
      html,
      tracking,
      groupTrackingConfig,
    });

    expect(out).toContain('utm_source=newsletter');
    expect(out).not.toContain('utm_source=stale');
    expect(out).toContain('keep=1');
  });

  it('handles plain `&` separators too (no double-encoding)', () => {
    // Some pipelines produce raw `&` in href values; the function should still
    // produce a valid `&amp;`-encoded result without doubling the entity.
    const html = '<a href="https://example.com/?utm_source=stale&keep=1">x</a>';

    const { html: out } = handleTrackingData({
      html,
      tracking,
      groupTrackingConfig,
    });

    expect(out).toContain('utm_source=newsletter');
    expect(out).not.toContain('&amp;amp;');
  });

  it('returns the html unchanged when there is no tracking config at all', () => {
    const html = '<a href="https://example.com/?a=1">x</a>';
    const { html: out } = handleTrackingData({ html });
    expect(out).toBe(html);
  });
});
