/**
 * @jest-environment jsdom
 */

'use strict';

// The checks the server runs (links that answer, image weight once exported,
// blocklisted domains): what the editor sends it, and how it reads its answer.

const ko = require('knockout');
const {
  runQualityChecks,
  REMOTE_RULES,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const {
  installQualityReview,
} = require('../../../packages/editor/src/js/ext/quality/quality-review.js');
const { fakeViewModel, exportOf } = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const brokenLinks = require(`${RULES}/broken-links`);
const imageWeight = require(`${RULES}/image-weight`);
const imagesTotalWeight = require(`${RULES}/images-total-weight`);
const oversizedImages = require(`${RULES}/oversized-images`);
const domainBlocklists = require(`${RULES}/domain-blocklists`);
const dangerousLinks = require(`${RULES}/dangerous-links`);

const blocks = [{ id: 'b1', type: 'textBlock' }];
const KB = 1024;

function vmWith(blockHtml) {
  return fakeViewModel({ blocks, html: exportOf({ b1: blockHtml }) });
}

function check(rule, blockHtml, remote) {
  return runQualityChecks(vmWith(blockHtml), { rules: [rule], remote });
}

const remoteOf = ({ links = {}, images = {}, blocklists } = {}) => ({
  links,
  images,
  blocklists: blocklists || { enabled: false, listed: {} },
});

describe('what is sent to the server', () => {
  it("sends the client's web links and images, once each", () => {
    const { resources } = runQualityChecks(
      vmWith(`
        <a href="https://brand.com/a">A</a>
        <a href="https://brand.com/a">Again</a>
        <a href="mailto:x@brand.com">Mail</a>
        <a href="{{unsubscribe}}">Unsubscribe</a>
        <a href="https://brand.com/?id=%%ID%%">Tagged</a>
        <a href="#toreplace">Unfilled</a>
        <img src="https://cdn.brand.com/hero.jpg">
        <img src="https://cdn.brand.com/{{customer_id}}.jpg">
        <img src="http://localhost:3000/api/images/placeholder/300x200.png">
        <a href="https://brand.com/${'x'.repeat(
          2100
        )}">Too long for the server</a>
      `),
      { rules: [] }
    );
    expect(resources).toEqual({
      links: ['https://brand.com/a'],
      images: [{ url: 'https://cdn.brand.com/hero.jpg' }],
    });
  });

  it("never sends the template's frame", () => {
    const html =
      '<html><body><a href="https://frame.test">Logo</a>' +
      '<div id="b1"><a href="https://brand.com">Shop</a></div></body></html>';
    const { resources } = runQualityChecks(fakeViewModel({ blocks, html }), {
      rules: [],
    });
    expect(resources.links).toEqual(['https://brand.com']);
  });
});

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
      webRisk: { enabled: true, threats: {} },
    });
    expect(checks[0].status).toBe('passed');
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
});

describe('the review, with the server', () => {
  const html = '<a href="https://brand.com/x">Shop</a>';

  function setup(checkResources) {
    const vm = vmWith(html);
    vm.metadata.url = {
      qualityResources: '/api/mailings/m1/quality/resources',
    };
    installQualityReview(vm, ko, { defer: (fn) => fn(), checkResources });
    return vm;
  }

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('shows the local results at once, then adds the server ones', async () => {
    let answer;
    const checkResources = jest.fn(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        })
    );
    const vm = setup(checkResources);

    vm.quality.run();
    expect(vm.quality.status()).toBe('done');
    expect(vm.quality.remoteStatus()).toBe('running');
    await flush();
    expect(checkResources).toHaveBeenCalledWith(
      '/api/mailings/m1/quality/resources',
      {
        links: ['https://brand.com/x'],
        images: [],
      }
    );

    answer(
      remoteOf({
        links: { 'https://brand.com/x': { state: 'broken', httpStatus: 404 } },
      })
    );
    await flush();

    expect(vm.quality.remoteStatus()).toBe('done');
    expect(vm.quality.findings().map((f) => f.ruleId)).toContain(
      'broken-links'
    );
    const ruleIds = vm.quality.checks().map((c) => c.ruleId);
    // A link and no image: only the link check is listed.
    expect(ruleIds).toContain('broken-links');
    expect(ruleIds).not.toContain('image-weight');
    expect(ruleIds).not.toContain('domain-blocklists');
  });

  it('lists the server checks as not run when the server fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const vm = setup(jest.fn(() => Promise.reject(new Error('500'))));

    vm.quality.run();
    await flush();

    expect(vm.quality.remoteStatus()).toBe('error');
    const failed = vm.quality
      .checks()
      .filter((c) => c.status === 'error')
      .map((c) => c.ruleId);
    expect(failed).toEqual(
      REMOTE_RULES.filter((rule) => !rule.optional).map((rule) => rule.id)
    );
    console.error.mockRestore();
  });

  it('drops an answer a newer run replaced, and waits for it before asking again', async () => {
    const answers = [];
    const checkResources = jest.fn(
      () =>
        new Promise((resolve) => {
          answers.push(resolve);
        })
    );
    const vm = setup(checkResources);

    vm.quality.run();
    await flush();
    vm.quality.run();
    await flush();
    // The second request waits for the first: the server runs one at a time.
    expect(checkResources).toHaveBeenCalledTimes(1);

    answers[0](
      remoteOf({
        links: { 'https://brand.com/x': { state: 'broken', httpStatus: 404 } },
      })
    );
    await flush();
    expect(vm.quality.findings().map((f) => f.ruleId)).not.toContain(
      'broken-links'
    );
    expect(checkResources).toHaveBeenCalledTimes(2);

    answers[1](remoteOf({ links: { 'https://brand.com/x': { state: 'ok' } } }));
    await flush();
    expect(vm.quality.remoteStatus()).toBe('done');
  });

  it('opens the drawer after an export when the server finds something to fix', async () => {
    const vm = setup(() =>
      Promise.resolve(
        remoteOf({
          links: {
            'https://brand.com/x': { state: 'broken', httpStatus: 404 },
          },
        })
      )
    );
    vm.showQuality(false);

    vm.quality.review();
    // Nothing local to show: the export goes on, the drawer stays shut…
    expect(vm.showQuality()).toBe(false);
    await flush();
    await flush();
    // …until the server finds the broken link.
    expect(vm.showQuality()).toBe(true);
  });

  it('keeps the drawer shut when the server finds nothing, or only what was ignored', async () => {
    const vm = setup(() =>
      Promise.resolve(
        remoteOf({ links: { 'https://brand.com/x': { state: 'ok' } } })
      )
    );
    vm.showQuality(false);
    vm.quality.review();
    await flush();
    await flush();
    expect(vm.showQuality()).toBe(false);
  });

  it('never sends a request a newer run already replaced', async () => {
    const checkResources = jest.fn(() => Promise.resolve(remoteOf()));
    const vm = setup(checkResources);

    vm.quality.run();
    vm.quality.run();
    await flush();

    expect(checkResources).toHaveBeenCalledTimes(1);
    expect(vm.quality.remoteStatus()).toBe('done');
  });

  it('asks nothing when there is nothing to check', () => {
    const vm = fakeViewModel({
      blocks,
      html: exportOf({ b1: '<p>Hello</p>' }),
    });
    vm.metadata.url = { qualityResources: '/x' };
    const checkResources = jest.fn();
    installQualityReview(vm, ko, { defer: (fn) => fn(), checkResources });

    vm.quality.run();
    expect(checkResources).not.toHaveBeenCalled();
    expect(vm.quality.remoteStatus()).toBe('idle');
  });
});
