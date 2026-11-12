/**
 * @jest-environment jsdom
 */

'use strict';

// The checks the server runs (links that answer, image weight once exported,
// blocklisted domains, dangerous links): how the editor reads its answer.
// What it sends, and the review around the request: remote-review.test.js.

const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const { vmWith, remoteOf } = require('./remote-fixtures');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const brokenLinks = require(`${RULES}/broken-links`);
const imageWeight = require(`${RULES}/image-weight`);
const imagesTotalWeight = require(`${RULES}/images-total-weight`);
const oversizedImages = require(`${RULES}/oversized-images`);
const domainBlocklists = require(`${RULES}/domain-blocklists`);
const dangerousLinks = require(`${RULES}/dangerous-links`);

const KB = 1024;

function check(rule, blockHtml, remote) {
  return runQualityChecks(vmWith(blockHtml), { rules: [rule], remote });
}

describe('broken-links', () => {
  const html = '<a href="https://brand.com/x">Shop now</a>';

  it.each([
    [
      { state: 'broken', httpStatus: 404 },
      'error',
      'Broken link (__status__): __label__',
    ],
    [
      { state: 'broken', reason: 'not-found' },
      'error',
      'Link to a domain that does not exist: __label__',
    ],
    [
      { state: 'unverifiable', httpStatus: 403 },
      'info',
      'Link could not be checked (__status__), check it by hand: __label__',
    ],
    [
      { state: 'unverifiable', reason: 'timeout' },
      'info',
      'Link did not answer in time, check it by hand: __label__',
    ],
  ])('reads %j', (result, severity, messageKey) => {
    const { findings } = check(
      brokenLinks,
      html,
      remoteOf({ links: { 'https://brand.com/x': result } })
    );
    expect(findings).toEqual([
      expect.objectContaining({
        severity,
        messageKey,
        blockId: 'b1',
        params: { label: 'Shop now', status: result.httpStatus },
      }),
    ]);
  });

  it('brings back an ignored "could not be checked" once the link is broken', () => {
    const fingerprintFor = (result) =>
      check(
        brokenLinks,
        html,
        remoteOf({ links: { 'https://brand.com/x': result } })
      ).findings[0].fingerprint;
    expect(fingerprintFor({ state: 'unverifiable', httpStatus: 403 })).not.toBe(
      fingerprintFor({ state: 'broken', httpStatus: 404 })
    );
  });

  it('is not listed when no link was checked', () => {
    expect(check(brokenLinks, html, remoteOf()).checks).toEqual([]);
  });

  it('passes, counting the links checked', () => {
    const { findings, checks } = check(
      brokenLinks,
      html,
      remoteOf({ links: { 'https://brand.com/x': { state: 'ok' } } })
    );
    expect(findings).toEqual([]);
    expect(checks[0]).toMatchObject({
      status: 'passed',
      passParams: { count: 1 },
    });
  });
});

describe('image weight', () => {
  const img = (src, width = 600) => `<img src="${src}" width="${width}">`;
  const images = (entries) => remoteOf({ images: entries });

  it('warns about an image over 500 KB, a GIF over 1 MB', () => {
    const { findings } = check(
      imageWeight,
      img('https://cdn.test/a.jpg') +
        img('https://cdn.test/b.gif') +
        img('https://cdn.test/c.gif'),
      images({
        'https://cdn.test/a.jpg': { state: 'ok', bytes: 800 * KB, type: 'jpg' },
        'https://cdn.test/b.gif': { state: 'ok', bytes: 800 * KB, type: 'gif' },
        'https://cdn.test/c.gif': {
          state: 'ok',
          bytes: 1500 * KB,
          type: 'gif',
        },
      })
    );
    expect(findings.map((f) => [f.messageKey, f.params.size])).toEqual([
      ['Heavy image (__size__ KB): keep it under __max__ KB', '800'],
      ['Heavy GIF (__size__ KB): keep it under __max__ KB', '1500'],
    ]);
  });

  it('warns about an image the export cannot download', () => {
    const { findings } = check(
      imageWeight,
      img('https://cdn.test/gone.png?v=2'),
      images({ 'https://cdn.test/gone.png?v=2': { state: 'unreachable' } })
    );
    expect(findings[0].params).toEqual({ name: 'gone.png' });
  });

  it('blocks on an image surely gone only, when the check blocks', () => {
    const blocks = (result) => {
      const vm = vmWith(img('https://cdn.test/a.png'));
      vm.metadata.qualitySettings = {
        checks: { 'image-weight': { state: 'blocking', thresholds: {} } },
      };
      return runQualityChecks(vm, {
        rules: [imageWeight],
        remote: images({
          'https://cdn.test/a.png': { state: 'unreachable', ...result },
        }),
      }).findings[0].blocking;
    };
    expect(blocks({ httpStatus: 404 })).toBe(true);
    expect(blocks({ httpStatus: 410 })).toBe(true);
    expect(blocks({ reason: 'not-found' })).toBe(true);
    // A refusal of the server's robot: a reader may well get the image.
    expect(blocks({ httpStatus: 403 })).toBe(false);
    expect(blocks({ httpStatus: 429 })).toBe(false);
  });

  it('does not judge an image the server could not reach on purpose', () => {
    const { findings, checks } = check(
      imageWeight,
      img('http://intranet.test/a.png'),
      images({ 'http://intranet.test/a.png': { state: 'unverifiable' } })
    );
    expect(findings).toEqual([]);
    // Nothing weighed, nothing to say: the check is not listed.
    expect(checks).toEqual([]);
  });

  it('brings back an ignored "could not be downloaded" once the image turns heavy', () => {
    const src = 'https://cdn.test/a.jpg';
    const fingerprintFor = (result) =>
      check(imageWeight, img(src), images({ [src]: result })).findings[0]
        .fingerprint;
    expect(fingerprintFor({ state: 'unreachable' })).not.toBe(
      fingerprintFor({ state: 'ok', bytes: 900 * KB })
    );
  });

  it('adds up every image once, warning past 500 KB and failing past 1 MB', () => {
    const html = img('https://cdn.test/a.jpg') + img('https://cdn.test/a.jpg');
    const total = (bytes) =>
      check(
        imagesTotalWeight,
        html,
        images({ 'https://cdn.test/a.jpg': { state: 'ok', bytes } })
      ).findings;

    expect(total(400 * KB)).toEqual([]);
    expect(total(600 * KB)[0]).toMatchObject({
      severity: 'warning',
      params: { size: 600 },
    });
    expect(total(1200 * KB)[0]).toMatchObject({ severity: 'error' });
  });

  it('notes an image more than twice as wide as it is shown', () => {
    const { findings } = check(
      oversizedImages,
      img('https://cdn.test/a.jpg', 300) + img('https://cdn.test/b.jpg', 300),
      images({
        'https://cdn.test/a.jpg': { state: 'ok', bytes: 1, width: 1200 },
        'https://cdn.test/b.jpg': { state: 'ok', bytes: 1, width: 600 },
      })
    );
    expect(findings).toEqual([
      expect.objectContaining({ params: { width: 1200, shown: 300 } }),
    ]);
  });
});

describe('dangerous-links', () => {
  const html = '<a href="https://bad.test/login">Log in</a>';

  it('is not listed where no Web Risk key is configured', () => {
    expect(check(dangerousLinks, html, remoteOf()).checks).toEqual([]);
  });

  it('names the worst threat Google lists the link under', () => {
    const { findings } = check(dangerousLinks, html, {
      ...remoteOf(),
      webRisk: {
        enabled: true,
        threats: {
          'https://bad.test/login': ['MALWARE', 'SOCIAL_ENGINEERING'],
        },
      },
    });
    expect(findings).toEqual([
      expect.objectContaining({
        severity: 'error',
        messageKey: 'Google lists this link as phishing: __label__',
        params: { label: 'Log in' },
        blockId: 'b1',
      }),
    ]);
  });

  it('passes when Google lists none', () => {
    const { checks } = check(dangerousLinks, html, {
      ...remoteOf(),
      webRisk: { enabled: true, threats: {}, unchecked: [] },
    });
    expect(checks[0].status).toBe('passed');
  });

  it('is not listed when Google could be asked about none of the links', () => {
    // A revoked key, a spent budget: "lists none as dangerous" would be false.
    const { checks, findings } = check(dangerousLinks, html, {
      ...remoteOf(),
      webRisk: {
        enabled: true,
        threats: {},
        unchecked: ['https://bad.test/login'],
      },
    });
    expect(checks).toEqual([]);
    expect(findings).toEqual([]);
  });

  it('notes the links Google could not be asked about, next to the ones it lists', () => {
    const { findings } = check(
      dangerousLinks,
      html + '<a href="https://other.test/">Other</a>',
      {
        ...remoteOf(),
        webRisk: {
          enabled: true,
          threats: { 'https://bad.test/login': ['MALWARE'] },
          unchecked: ['https://other.test/'],
        },
      }
    );
    expect(findings).toEqual([
      expect.objectContaining({
        severity: 'error',
        messageKey: 'Google lists this link as malware: __label__',
      }),
      expect.objectContaining({
        severity: 'info',
        messageKey:
          'Google could not check this link, check it by hand: __label__',
        params: { label: 'Other' },
        blockId: 'b1',
      }),
    ]);
    // Ignoring "could not check" must not hide a later listing.
    expect(findings[0].fingerprint).not.toBe(findings[1].fingerprint);
  });
});

describe('domain-blocklists', () => {
  const html = '<a href="https://www.shady.co.uk/offer">Offer</a>';

  it('is not listed where no blocklist is configured', () => {
    expect(check(domainBlocklists, html, remoteOf()).checks).toEqual([]);
  });

  it('warns about a listed domain, on the block of its link', () => {
    const { findings } = check(
      domainBlocklists,
      html,
      remoteOf({
        blocklists: {
          enabled: true,
          listed: { 'shady.co.uk': ['Spamhaus DBL'] },
        },
      })
    );
    expect(findings).toEqual([
      expect.objectContaining({
        blockId: 'b1',
        params: { domain: 'shady.co.uk', lists: 'Spamhaus DBL' },
      }),
    ]);
  });

  it("is not listed when the blocklists could be asked about none of the links' domains", () => {
    const { checks } = check(
      domainBlocklists,
      html,
      remoteOf({
        blocklists: { enabled: true, listed: {}, unchecked: ['shady.co.uk'] },
      })
    );
    expect(checks).toEqual([]);
  });

  it('notes the domains the blocklists could not be asked about, on the block of their link', () => {
    const { findings, checks } = check(
      domainBlocklists,
      html + '<a href="https://fine.test/">Fine</a>',
      remoteOf({
        blocklists: { enabled: true, listed: {}, unchecked: ['shady.co.uk'] },
      })
    );
    expect(checks[0].status).toBe('failed');
    expect(findings).toEqual([
      expect.objectContaining({
        severity: 'info',
        messageKey:
          'Domain could not be checked against the blocklists: __domain__',
        params: { domain: 'shady.co.uk' },
        blockId: 'b1',
      }),
    ]);
  });
});
