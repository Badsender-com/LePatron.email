/**
 * @jest-environment jsdom
 */

'use strict';

// From the QC review in Notion (13/10): an address without an extension (a
// CDN's /img/12345) said nothing of its format. The server reads the image it
// weighs, and its type now judges the format in a second look of the local
// check, never blocking. It asks the server only while a server check reads
// the images (#1267): those images are downloaded for that check anyway, and
// an admin who turned the image checks off stopped those calls.

const ko = require('knockout');
const {
  runQualityChecks,
  REMOTE_RULES,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const {
  installQualityReview,
} = require('../../../packages/editor/src/js/ext/quality/quality-review.js');
const {
  mergeChecks,
} = require('../../../packages/editor/src/js/ext/quality/remote-checks.js');
const { vmWith, remoteOf } = require('./remote-fixtures');

const KB = 1024;
const FORMATS = 'unsupported-image-formats';
const src = 'https://cdn.test/img/12345';
const IMAGE_CHECKS = REMOTE_RULES.filter((rule) => rule.reads === 'images').map(
  (rule) => rule.id
);
const OFF = { state: 'off', thresholds: {} };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const imageOf = (type) => ({
  state: 'ok',
  bytes: 20 * KB,
  width: 600,
  height: 300,
  type,
});

// An editor on `blockHtml` with the quality settings `checks`, its server
// answering through `checkResources`.
function editor({ blockHtml, checks = {}, checkResources }) {
  const vm = vmWith(blockHtml || `<img src="${src}" width="600">`);
  vm.metadata.url = { qualityResources: '/x' };
  vm.metadata.qualitySettings = { checks };
  installQualityReview(vm, ko, { defer: (fn) => fn(), checkResources });
  return vm;
}

function review(type, state = 'on') {
  return editor({
    checks: { [FORMATS]: { state, thresholds: {} } },
    checkResources: () =>
      Promise.resolve(remoteOf({ images: { [src]: imageOf(type) } })),
  });
}

const formatsOf = (vm) => ({
  findings: vm.quality.findings().filter((f) => f.ruleId === FORMATS),
  checks: vm.quality.checks().filter((c) => c.ruleId === FORMATS),
});

const turnedOff = (ids) => Object.fromEntries(ids.map((id) => [id, OFF]));

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('the format of an image whose address names none', () => {
  it('is judged by the type the server read', async () => {
    const vm = review('webp');
    vm.quality.run();
    await flush();
    const { findings, checks } = formatsOf(vm);
    expect(findings.map((f) => f.params.format)).toEqual(['WEBP']);
    // Still one check in the drawer, failed.
    expect(checks.map((c) => c.status)).toEqual(['failed']);
  });

  it('passes a format every client shows', async () => {
    const vm = review('png');
    vm.quality.run();
    await flush();
    const { findings, checks } = formatsOf(vm);
    expect(findings).toEqual([]);
    expect(checks.map((c) => c.status)).toEqual(['passed']);
    // The server read it: every image was judged.
    expect(checks[0].passKey).toBe(
      'Every image uses a format email clients show'
    );
  });

  it('never blocks the export', async () => {
    const vm = review('webp', 'blocking');
    vm.quality.run();
    await flush();
    expect(formatsOf(vm).findings.map((f) => f.blocking)).toEqual([false]);
  });

  it('neither makes the export wait nor blocks it', async () => {
    const vm = review('webp', 'blocking');
    const verdict = vm.quality.gate({ html: vm.exportHTML() });
    // No wait shown: the gate waits only for a blocking check of the server.
    expect(document.querySelector('.quality-wait-modal')).toBeNull();
    const { leaves, blocked } = await verdict;
    expect(blocked).toBe(false);
    expect(leaves).toBe(true);
  });

  it('counts a local finding and a finding of the second look on one line', async () => {
    const vm = editor({
      blockHtml: `<img src="https://cdn.test/hero.webp"><img src="${src}">`,
      checkResources: () =>
        Promise.resolve(remoteOf({ images: { [src]: imageOf('avif') } })),
    });
    vm.quality.run();
    await flush();
    const { findings, checks } = formatsOf(vm);
    expect(findings.map((f) => f.params.format)).toEqual(['WEBP', 'AVIF']);
    expect(checks).toEqual([
      expect.objectContaining({ status: 'failed', count: 2 }),
    ]);
  });
});

describe('what the second look asks the server', () => {
  it('names the format check along with a server check reading the images', () => {
    const vm = vmWith(`<img src="${src}" width="600">`);
    const { resources } = runQualityChecks(vm, { rules: [] });
    expect(resources.images).toEqual([{ url: src }]);
    expect(resources.checks).toContain(FORMATS);
  });

  it('names it along with the one server check reading the images still on', () => {
    const vm = vmWith(`<img src="${src}" width="600">`);
    vm.metadata.qualitySettings = {
      checks: turnedOff(IMAGE_CHECKS.slice(1)),
    };
    const { resources } = runQualityChecks(vm, { rules: [] });
    expect(resources.images).toEqual([{ url: src }]);
    expect(resources.checks).toEqual(
      expect.arrayContaining([IMAGE_CHECKS[0], FORMATS])
    );
  });

  it('asks the server nothing when every server check is off', async () => {
    const checkResources = jest.fn();
    const vm = editor({
      checks: turnedOff(REMOTE_RULES.map((rule) => rule.id)),
      checkResources,
    });
    vm.quality.run();
    await flush();
    expect(checkResources).not.toHaveBeenCalled();
    // No "checking the links and images" line in the drawer.
    expect(vm.quality.remoteStatus()).toBe('idle');
    // Judged on the addresses alone: passed, saying one image was not judged.
    const [check] = formatsOf(vm).checks;
    expect(check.status).toBe('passed');
    expect(check.passParams).toEqual({ count: 1 });
  });

  it('sends no image for it when every server check reading the images is off', async () => {
    const checkResources = jest.fn(() => Promise.resolve(remoteOf()));
    const vm = editor({
      blockHtml: `<a href="https://brand.com">Shop</a><img src="${src}">`,
      checks: turnedOff(IMAGE_CHECKS),
      checkResources,
    });
    vm.quality.run();
    await flush();
    const [, body] = checkResources.mock.calls[0];
    expect(body.images).toEqual([]);
    expect(body.checks).not.toContain(FORMATS);
    expect(formatsOf(vm).checks.map((c) => c.status)).toEqual(['passed']);
  });

  it('asks the server nothing for an image whose address names its format', () => {
    const vm = vmWith('<img src="https://cdn.test/hero.webp" width="600">');
    vm.metadata.qualitySettings = {
      checks: turnedOff(REMOTE_RULES.map((rule) => rule.id)),
    };
    expect(runQualityChecks(vm, { rules: [] }).resources).toEqual({
      links: [],
      images: [],
      checks: [],
    });
  });
});

describe('the second look, when it cannot read the answer', () => {
  it('lists the format check as not run when the server fails, never as passed', async () => {
    const vm = editor({
      checkResources: () => Promise.reject(new Error('500')),
    });
    vm.quality.run();
    await flush();
    expect(formatsOf(vm).checks.map((c) => c.status)).toEqual(['error']);
  });

  it('keeps a local finding failed when the server fails', async () => {
    const vm = editor({
      blockHtml: `<img src="https://cdn.test/hero.webp"><img src="${src}">`,
      checkResources: () => Promise.reject(new Error('500')),
    });
    vm.quality.run();
    await flush();
    expect(formatsOf(vm).checks).toEqual([
      expect.objectContaining({ status: 'failed', count: 1 }),
    ]);
  });

  it('lists the format check as cancelled when the run is stopped', async () => {
    const vm = editor({ checkResources: () => new Promise(() => {}) });
    vm.quality.run();
    await flush();
    vm.quality.cancel();
    expect(formatsOf(vm).checks.map((c) => c.status)).toEqual(['cancelled']);
  });

  it('lists the format check as not run when its second look throws', async () => {
    const images = {};
    Object.defineProperty(images, src, {
      enumerable: true,
      get() {
        throw new Error('unreadable answer');
      },
    });
    const vm = editor({
      checkResources: () => Promise.resolve(remoteOf({ images })),
    });
    vm.quality.run();
    await flush();
    expect(vm.quality.remoteStatus()).toBe('done');
    expect(formatsOf(vm)).toEqual({
      findings: [],
      checks: [expect.objectContaining({ status: 'error' })],
    });
  });
});

describe('mergeChecks', () => {
  const check = (ruleId, status, count = 0) => ({ ruleId, status, count });

  it('lists a check of both runs once, failed with both counts', () => {
    expect(
      mergeChecks([check(FORMATS, 'failed', 1)], [check(FORMATS, 'failed', 1)])
    ).toEqual([check(FORMATS, 'failed', 2)]);
  });

  it('fails a check the local run passed and the second look did not', () => {
    expect(
      mergeChecks([check(FORMATS, 'passed')], [check(FORMATS, 'failed', 1)])
    ).toEqual([check(FORMATS, 'failed', 1)]);
  });

  it('never leaves passed a check whose second look could not run', () => {
    expect(
      mergeChecks(
        [check(FORMATS, 'passed'), check('subject', 'passed')],
        [check(FORMATS, 'error')]
      )
    ).toEqual([check(FORMATS, 'error'), check('subject', 'passed')]);
    expect(
      mergeChecks([check(FORMATS, 'passed')], [check(FORMATS, 'cancelled')])
    ).toEqual([check(FORMATS, 'cancelled')]);
  });

  it('keeps a local failure over a second look that could not run', () => {
    expect(
      mergeChecks([check(FORMATS, 'failed', 1)], [check(FORMATS, 'error')])
    ).toEqual([check(FORMATS, 'failed', 1)]);
  });

  it('adds the checks only the server runs after the local ones', () => {
    expect(
      mergeChecks(
        [check('subject', 'passed')],
        [check('broken-links', 'error')]
      )
    ).toEqual([check('subject', 'passed'), check('broken-links', 'error')]);
  });
});
