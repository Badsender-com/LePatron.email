/**
 * @jest-environment jsdom
 */

'use strict';

// The quality gate of the exports (ADR 0009): a finding of a blocking check
// stops the download and the ESP send, listed in a modal; the wait for the
// server is bounded and can be cancelled; a failure of the checks never
// blocks, but says what was not checked.

const ko = require('knockout');
const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const {
  installQualityReview,
} = require('../../../packages/editor/src/js/ext/quality/quality-review.js');
const {
  SERVER_WAIT_MS,
} = require('../../../packages/editor/src/js/ext/quality/quality-gate.js');
const {
  displayBlockingFindings,
} = require('../../../packages/editor/src/js/ext/badsender-control-quality.js');
const {
  kbSize,
} = require('../../../packages/editor/src/js/ext/quality/message-params.js');
const { fakeViewModel, exportOf } = require('./fake-view-model');
const { remoteOf } = require('./remote-fixtures');

const GONE = 'https://brand.test/gone';
const UNCHECKED =
  'The links and images could not be checked: check them yourself before the email leaves.';
const TOO_FREQUENT =
  'Too many checks in a short time: the links and images were not checked. Check them yourself before the email leaves.';
const BLOCKING = { state: 'blocking', thresholds: {} };

const emailOf = (longText) => ({
  blocks: [{ id: 'b1', type: 'textBlock', longText }],
  blockDefs: [{ type: 'textBlock', longText: '<p>Sample</p>' }],
  html: exportOf({ b1: longText }),
});
const withLink = emailOf(`<a href="${GONE}">Our offer</a>`);

// An editor whose mailing makes `checks` blocking, its server answering
// with `answer` (quality-remote's postResources).
function editor({ email = withLink, checks = {}, answer, ...deps } = {}) {
  const vm = fakeViewModel(email);
  vm.metadata.qualitySettings = { checks };
  vm.metadata.url = { qualityResources: '/api/mailings/m1/quality/resources' };
  vm.notifier = { info: jest.fn(), warning: jest.fn(), error: jest.fn() };
  installQualityReview(vm, ko, {
    defer: (fn) => fn(),
    checkResources: answer || jest.fn(() => new Promise(() => {})),
    watchContent: () => () => {},
    ...deps,
  });
  return vm;
}

// A server that has not answered yet; `token` is the request's, and the
// request fails as axios does once it is aborted.
function pendingServer() {
  const server = {};
  server.answer = jest.fn(
    (url, resources, { cancelToken }) =>
      new Promise((resolve, reject) => {
        server.token = cancelToken;
        server.resolve = resolve;
        server.reject = reject;
        cancelToken.promise.then(reject);
      })
  );
  return server;
}

// The request leaves on a later tick, behind any earlier one.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const $ = (selector) => document.querySelector(selector);

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('waiting for a blocking check of the server', () => {
  const checks = { 'broken-links': BLOCKING };

  it('shows the wait, with a Cancel button, until the server answers', async () => {
    const server = pendingServer();
    const vm = editor({ checks, answer: server.answer });
    const verdict = vm.quality.gate({ html: withLink.html });
    expect($('.quality-wait-modal').getAttribute('aria-busy')).toBe('true');
    expect($('.quality-wait-modal__cancel').textContent).toBe(
      'quality-action-cancel'
    );
    await flush();
    server.resolve(remoteOf({ links: { [GONE]: { state: 'ok' } } }));
    expect((await verdict).leaves).toBe(true);
    expect($('.quality-wait-modal')).toBeNull();
    expect(vm.notifier.warning).not.toHaveBeenCalled();
  });

  it('lets the email leave with a notice when the wait runs out, and stops the request', async () => {
    jest.useFakeTimers();
    const server = pendingServer();
    const vm = editor({ checks, answer: server.answer });
    const verdict = vm.quality.gate({ html: withLink.html });
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(SERVER_WAIT_MS);
    const { leaves, unchecked } = await verdict;
    expect(leaves).toBe(true);
    expect(unchecked).toBe('timeout');
    expect(vm.notifier.warning).toHaveBeenCalledWith(UNCHECKED);
    expect($('.quality-wait-modal')).toBeNull();
    expect(server.token.reason).toBeDefined();
  });

  it('lists the checks of the server as cancelled once the wait ran out, not as a failure', async () => {
    jest.useFakeTimers();
    const server = pendingServer();
    const vm = editor({ checks, answer: server.answer });
    const verdict = vm.quality.gate({ html: withLink.html });
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(SERVER_WAIT_MS);
    await verdict;
    jest.useRealTimers();
    await flush();
    const brokenLinks = vm.quality
      .checks()
      .find((check) => check.ruleId === 'broken-links');
    expect(brokenLinks.status).toBe('cancelled');
    expect(vm.quality.remoteStatus()).toBe('idle');
    expect(vm.quality.remoteError()).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('lets the email leave with a notice when the user ran too many checks', async () => {
    const tooFrequent = Object.assign(new Error('429'), {
      response: {
        status: 429,
        data: { message: 'QUALITY_CHECKS_TOO_FREQUENT' },
      },
    });
    const vm = editor({ checks, answer: () => Promise.reject(tooFrequent) });
    const { leaves, unchecked } = await vm.quality.gate({
      html: withLink.html,
    });
    expect(leaves).toBe(true);
    expect(unchecked).toBe('too-frequent');
    expect(vm.notifier.warning).toHaveBeenCalledWith(TOO_FREQUENT);
    expect(vm.quality.remoteError()).toBe('too-frequent');
  });

  it('lets the email leave with a notice when the server fails', async () => {
    const failure = Object.assign(new Error('500'), {
      response: { status: 500, data: {} },
    });
    const vm = editor({ checks, answer: () => Promise.reject(failure) });
    const { leaves, unchecked } = await vm.quality.gate({
      html: withLink.html,
    });
    expect(leaves).toBe(true);
    expect(unchecked).toBe('failed');
    expect(vm.notifier.warning).toHaveBeenCalledWith(UNCHECKED);
  });

  it('abandons the export on Cancel: nothing leaves, and the request is aborted', async () => {
    const server = pendingServer();
    const vm = editor({ checks, answer: server.answer });
    const verdict = vm.quality.gate({ html: withLink.html });
    await flush();
    $('.quality-wait-modal__cancel').click();
    const { leaves, cancelled } = await verdict;
    expect(leaves).toBe(false);
    expect(cancelled).toBe(true);
    expect(server.token.reason).toBeDefined();
    expect($('.quality-wait-modal')).toBeNull();
    expect($('.blocking-modal')).toBeNull();
    expect(vm.notifier.warning).not.toHaveBeenCalled();
    // Listed as cancelled, never as passed.
    const brokenLinks = vm.quality
      .checks()
      .find((check) => check.ruleId === 'broken-links');
    expect(brokenLinks.status).toBe('cancelled');
  });
});

describe('a local finding that blocks', () => {
  it('shows the modal at once, without waiting for the server', async () => {
    const email = emailOf(
      `<a href="#toreplace">Shop now</a><a href="${GONE}">Our offer</a>`
    );
    const vm = editor({
      email,
      checks: { 'unfilled-links': BLOCKING, 'broken-links': BLOCKING },
    });
    const { blocked, findings } = await vm.quality.gate({ html: email.html });
    expect(blocked).toBe(true);
    expect(findings.map((f) => f.ruleId)).toEqual(['unfilled-links']);
    expect($('.quality-wait-modal')).toBeNull();
    expect($('.blocking-modal')).not.toBeNull();
  });
});

describe('the verdict', () => {
  const unfilled = emailOf('<a href="#toreplace">Shop now</a>');
  const checks = { 'unfilled-links': BLOCKING };

  it('stays blocked when the modal cannot be shown', async () => {
    const vm = editor({
      email: unfilled,
      checks,
      displayBlockingFindings: () => {
        throw new Error('no modal');
      },
    });
    const verdict = await vm.quality.gate({ html: unfilled.html });
    expect(verdict.leaves).toBe(false);
    expect(verdict.blocked).toBe(true);
    expect(console.error).toHaveBeenCalled();
  });

  it('never blocks on a failure of the checks', async () => {
    const vm = editor({
      run: () => {
        throw new Error('boom');
      },
    });
    expect((await vm.quality.gate({ html: '<p></p>' })).leaves).toBe(true);
  });

  it('runs the checks after the click, the export shown as being checked', () => {
    let deferred;
    const run = jest.fn((viewModel, options) =>
      runQualityChecks(viewModel, options)
    );
    const vm = editor({ email: unfilled, run, defer: (fn) => (deferred = fn) });
    const profile = { id: 'p1' };
    vm.quality.gate({ html: unfilled.html, target: profile });
    expect(run).not.toHaveBeenCalled();
    expect(vm.quality.gating()).toBe(profile);
    deferred();
    expect(run).toHaveBeenCalled();
  });

  it('checks one export at a time, and says so to a second one', async () => {
    const vm = editor({ checks: { 'broken-links': BLOCKING } });
    vm.quality.gate({ html: withLink.html, target: 'download' });
    const second = await vm.quality.gate({ html: withLink.html });
    expect(second.leaves).toBe(false);
    expect(second.busy).toBe(true);
    expect(vm.notifier.info).toHaveBeenCalledWith(
      'The quality checks of this email are still running: wait for them to finish'
    );
    expect(vm.quality.gating()).toBe('download');
  });
});

describe('the blocking modal', () => {
  const checks = { 'unfilled-links': BLOCKING };

  it('says the company made these checks blocking, closes, and leads to the finding in the drawer', async () => {
    const email = emailOf('<a href="#toreplace">Shop now</a>');
    const vm = editor({ email, checks });
    const { findings } = await vm.quality.gate({ html: email.html });

    expect($('.blocking-modal').textContent).toContain(
      'Your company made these checks blocking: fix them before downloading or sending the email.'
    );
    expect($('.blocking-modal__close').textContent).toBe(
      'quality-action-close'
    );
    $('.blocking-modal__reveal').click();
    expect($('.blocking-modal')).toBeNull();
    expect(vm.showQuality()).toBe(true);
    expect(vm.quality.tab()).toBe('checks');
    expect(vm.quality.focus().fingerprint).toBe(findings[0].fingerprint);
  });

  it('shows a link label containing HTML as text', async () => {
    const email = emailOf(
      '<a href="#toreplace">&lt;img src=x onerror=alert(1)&gt;Shop</a>'
    );
    const vm = editor({ email, checks });
    await vm.quality.gate({ html: email.html });
    const item = $('.blocking-modal__item');
    expect(item.textContent).toContain('<img src=x onerror=alert(1)>Shop');
    expect(item.querySelector('img')).toBeNull();
  });

  it('writes the parameters of a message for its reader', () => {
    displayBlockingFindings(
      [
        {
          titleKey: 'Images too heavy',
          messageKey: 'Over __max__',
          params: { max: kbSize(2048) },
          blocking: true,
        },
      ],
      fakeViewModel()
    );
    const text = $('.blocking-modal__item').textContent;
    expect(text).toContain('Over 2 MB');
    expect(text).not.toContain('[object Object]');
  });
});

describe("presenting the gate's results after an ESP send", () => {
  it('opens the drawer on them without asking the server again, even after another run', async () => {
    const email = emailOf(
      `<a href="#toreplace">Shop now</a><a href="${GONE}">Our offer</a>`
    );
    const answer = jest.fn(() =>
      Promise.resolve(remoteOf({ links: { [GONE]: { state: 'ok' } } }))
    );
    const vm = editor({ email, answer });
    const verdict = await vm.quality.gate({ html: email.html, quiet: true });
    await flush();
    expect(vm.showQuality()).toBe(false);
    const gateFindings = vm.quality.findings();

    vm.quality.review({ html: '<p></p>', silent: true });
    await flush();
    const asked = answer.mock.calls.length;
    verdict.present();

    expect(vm.showQuality()).toBe(true);
    expect(vm.quality.findings()).toEqual(gateFindings);
    expect(answer).toHaveBeenCalledTimes(asked);
  });
});
