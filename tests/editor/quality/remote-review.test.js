/**
 * @jest-environment jsdom
 */

'use strict';

// The checks the server runs, seen from the review: what the editor sends,
// and how the server's results join the local ones.

const ko = require('knockout');
const {
  runQualityChecks,
  REMOTE_RULES,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const {
  installQualityReview,
} = require('../../../packages/editor/src/js/ext/quality/quality-review.js');
const { fakeViewModel, exportOf } = require('./fake-view-model');
const { blocks, vmWith, remoteOf } = require('./remote-fixtures');

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
      },
      expect.objectContaining({ cancelToken: expect.anything() })
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
