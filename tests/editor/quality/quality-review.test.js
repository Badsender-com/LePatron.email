/**
 * @jest-environment jsdom
 */

'use strict';

const ko = require('knockout');
const {
  installQualityReview,
} = require('../../../packages/editor/src/js/ext/quality/quality-review.js');

const finding = (severity) => ({ severity, fingerprint: severity });

function setup(result = { findings: [], checks: [] }) {
  const vm = {};
  const run = jest.fn(() => result);
  const deferred = [];
  installQualityReview(vm, ko, { run, defer: (fn) => deferred.push(fn) });
  const flush = () => deferred.splice(0).forEach((fn) => fn());
  return { vm, run, flush };
}

describe('installQualityReview', () => {
  it('starts idle, drawer closed', () => {
    const { vm } = setup();
    expect(vm.quality.status()).toBe('idle');
    expect(vm.showQuality()).toBe(false);
  });

  it('shows "running" until the deferred run completes', () => {
    const { vm, flush } = setup({
      findings: [finding('error')],
      checks: [{ status: 'failed' }],
    });
    vm.quality.run();
    expect(vm.quality.status()).toBe('running');

    flush();
    expect(vm.quality.status()).toBe('done');
    expect(vm.quality.findings()).toHaveLength(1);
    expect(vm.quality.ranAt()).toBeInstanceOf(Date);
  });

  it('drops the result of a cancelled run', () => {
    const { vm, run, flush } = setup();
    vm.quality.run();
    vm.quality.cancel();
    flush();

    expect(run).not.toHaveBeenCalled();
    expect(vm.quality.status()).toBe('idle');
  });

  it('counts errors and warnings, not infos, for the toolbar badge', () => {
    const { vm, flush } = setup({
      findings: [finding('error'), finding('warning'), finding('info')],
      checks: [{ status: 'passed' }, { status: 'failed' }],
    });
    vm.quality.run();
    flush();

    expect(vm.quality.issueCount()).toBe(2);
    expect(vm.quality.passedCount()).toBe(1);
  });

  it('reviews an export on the spot and opens the drawer on findings', () => {
    const { vm, run } = setup({ findings: [finding('warning')], checks: [] });
    vm.quality.review({ html: '<p></p>' });

    expect(run).toHaveBeenCalledWith(vm, { html: '<p></p>' });
    expect(vm.quality.status()).toBe('done');
    expect(vm.showQuality()).toBe(true);
  });

  it('leaves the drawer closed when an export has nothing to show', () => {
    const { vm } = setup({ findings: [], checks: [{ status: 'passed' }] });
    vm.quality.review();
    expect(vm.showQuality()).toBe(false);
  });

  it('never throws from a review, so the export goes on', () => {
    const vm = {};
    jest.spyOn(console, 'error').mockImplementation(() => {});
    installQualityReview(vm, ko, {
      run: () => {
        throw new Error('boom');
      },
    });

    expect(vm.quality.review()).toBeNull();
    expect(vm.quality.status()).toBe('idle');
    console.error.mockRestore();
  });
});
