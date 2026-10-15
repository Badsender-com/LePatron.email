/**
 * @jest-environment jsdom
 */

'use strict';

const ko = require('knockout');
const {
  installQualityReview,
} = require('../../../packages/editor/src/js/ext/quality/quality-review.js');
const {
  REMOTE_RULES,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');

const finding = (severity) => ({ severity, fingerprint: severity });

function setup(result = { findings: [], checks: [] }, extra = {}) {
  const vm = {
    exportHTML: jest.fn(() => '<p>exported</p>'),
    t: (key, params = {}) =>
      Object.keys(params).reduce(
        (s, k) => s.replace(`__${k}__`, params[k]),
        key
      ),
    notifier: { warning: jest.fn(), error: jest.fn() },
    ...extra.vm,
  };
  const run = jest.fn(() => result);
  const deferred = [];
  let changeContent = () => {};
  installQualityReview(vm, ko, {
    run,
    defer: (fn) => deferred.push(fn),
    watchContent: (_vm, _ko, onChange) => {
      changeContent = onChange;
      return () => {};
    },
    ...extra.deps,
  });
  const flush = () => deferred.splice(0).forEach((fn) => fn());
  return { vm, run, flush, changeContent: () => changeContent() };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

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

  it('counts the errors left, for the "Send a test" tab', () => {
    const { vm, flush } = setup({
      findings: [finding('error'), finding('error'), finding('warning')],
      checks: [],
    });
    vm.quality.run();
    flush();
    expect(vm.quality.errorCount()).toBe(2);
  });
});

describe('the review of an export', () => {
  it('takes the HTML at once and runs the checks after the click', () => {
    const { vm, run, flush } = setup({
      findings: [finding('warning')],
      checks: [],
    });
    expect(vm.quality.review({ html: '<p></p>' })).toBeNull();

    expect(run).not.toHaveBeenCalled();
    expect(vm.quality.status()).toBe('running');
    flush();
    expect(run).toHaveBeenCalledWith(vm, { html: '<p></p>' });
    expect(vm.quality.status()).toBe('done');
  });

  it('exports the email itself when no HTML is given, before deferring', () => {
    const { vm, run, flush } = setup();
    vm.quality.review();
    expect(vm.exportHTML).toHaveBeenCalledTimes(1);
    flush();
    expect(run).toHaveBeenCalledWith(vm, { html: '<p>exported</p>' });
  });

  it('opens the drawer on the results when something is to fix', () => {
    const { vm, flush } = setup({ findings: [finding('warning')], checks: [] });
    vm.quality.open('send');
    vm.quality.review();
    flush();
    expect(vm.showQuality()).toBe(true);
    expect(vm.quality.tab()).toBe('checks');
  });

  it('leaves the drawer closed on infos only, as the badge counts none', () => {
    const { vm, flush } = setup({
      findings: [finding('info'), finding('info')],
      checks: [{ status: 'passed' }],
    });
    vm.quality.review();
    flush();
    expect(vm.showQuality()).toBe(false);
  });

  it('leaves the drawer closed when an export has nothing to show', () => {
    const { vm, flush } = setup({
      findings: [],
      checks: [{ status: 'passed' }],
    });
    vm.quality.review();
    flush();
    expect(vm.showQuality()).toBe(false);
  });

  it('never opens the drawer when asked to stay silent', () => {
    const { vm, flush } = setup({ findings: [finding('error')], checks: [] });
    vm.quality.open('send');
    vm.showQuality(false);
    vm.quality.review({ html: '<p></p>', silent: true });
    flush();
    expect(vm.showQuality()).toBe(false);
    expect(vm.quality.tab()).toBe('send');
    expect(vm.quality.status()).toBe('done');
  });

  it('does not close a comment being written: it says how many issues instead', () => {
    const { vm, flush } = setup(
      { findings: [finding('error'), finding('warning')], checks: [] },
      {
        vm: {
          showComments: ko.observable(true),
          newCommentText: ko.observable('Please check the hero'),
        },
      }
    );
    vm.quality.review();
    flush();

    expect(vm.showQuality()).toBe(false);
    expect(vm.notifier.warning).toHaveBeenCalledWith(
      '2 issues to fix: open the quality control'
    );
  });

  it('opens the drawer when the comments panel is open without a draft', () => {
    const { vm, flush } = setup(
      { findings: [finding('error')], checks: [] },
      {
        vm: {
          showComments: ko.observable(true),
          newCommentText: ko.observable('   '),
        },
      }
    );
    vm.quality.review();
    flush();
    expect(vm.showQuality()).toBe(true);
    expect(vm.notifier.warning).not.toHaveBeenCalled();
  });

  it('never throws from a review, so the export goes on', () => {
    const vm = {
      exportHTML: () => {
        throw new Error('boom');
      },
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    installQualityReview(vm, ko, { watchContent: () => () => {} });

    expect(vm.quality.review()).toBeNull();
    expect(vm.quality.status()).toBe('idle');
    console.error.mockRestore();
  });
});

describe('results and the email changing', () => {
  it('marks the results stale once the email changes', () => {
    const { vm, flush, changeContent } = setup({
      findings: [finding('error')],
      checks: [],
    });
    vm.quality.run();
    flush();
    expect(vm.quality.status()).toBe('done');

    changeContent();
    expect(vm.quality.status()).toBe('stale');
    // The results themselves stay, for the user to read.
    expect(vm.quality.findings()).toHaveLength(1);

    vm.quality.run();
    flush();
    expect(vm.quality.status()).toBe('done');
  });

  it('marks stale a run the email changed during', () => {
    const { vm, flush, changeContent } = setup();
    vm.quality.run();
    changeContent();
    flush();
    expect(vm.quality.status()).toBe('stale');
  });

  it('keeps stale results stale when a re-run is cancelled', () => {
    const { vm, flush, changeContent } = setup();
    vm.quality.run();
    flush();
    changeContent();
    vm.quality.run();
    vm.quality.cancel();
    expect(vm.quality.status()).toBe('stale');
  });

  it('judges the HTML an export took, not the email as it is later', () => {
    const { vm, flush, changeContent } = setup();
    vm.quality.review({ html: '<p></p>' });
    changeContent();
    flush();
    expect(vm.quality.status()).toBe('stale');
  });
});

describe("the server's checks", () => {
  const resources = { links: ['https://brand.com/x'], images: [] };

  function setupRemote(checkResources, options = {}) {
    const ctx = { remote: null };
    const local = {
      findings: [],
      checks: [{ ruleId: 'local', status: 'passed' }],
      html: '<p></p>',
      resources,
      ctx,
    };
    const runRules = jest.fn(() => ({
      findings: [
        { ruleId: 'broken-links', severity: 'error', fingerprint: 'r' },
      ],
      checks: [{ ruleId: 'broken-links', status: 'failed' }],
    }));
    const base = setup(local, {
      vm: {
        metadata: { url: { qualityResources: '/api/m1/quality/resources' } },
      },
      deps: { checkResources, runRules, ...options.deps },
    });
    return { ...base, ctx, runRules };
  }

  it('runs the remote rules on the context of the local pass, parsed once', async () => {
    const remote = { links: {} };
    const checkResources = jest.fn(() => Promise.resolve(remote));
    const { vm, run, flush, ctx, runRules } = setupRemote(checkResources);

    vm.quality.run();
    flush();
    await tick();

    expect(checkResources).toHaveBeenCalledWith(
      '/api/m1/quality/resources',
      resources,
      expect.objectContaining({ cancelToken: expect.anything() })
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(runRules).toHaveBeenCalledWith(ctx, REMOTE_RULES);
    expect(ctx.remote).toBe(remote);
    expect(vm.quality.remoteStatus()).toBe('done');
    expect(vm.quality.findings().map((f) => f.ruleId)).toEqual([
      'broken-links',
    ]);
  });

  it('opens the drawer after an export on what the server finds, with the badge rule', async () => {
    const { vm, flush } = setupRemote(() => Promise.resolve({}));
    vm.quality.review();
    flush();
    expect(vm.showQuality()).toBe(false);
    await tick();
    expect(vm.showQuality()).toBe(true);
  });

  it('aborts the request on cancel, and lists the server checks as cancelled', async () => {
    let token;
    const checkResources = jest.fn(
      (_url, _resources, options) =>
        new Promise((resolve, reject) => {
          token = options.cancelToken;
          token.promise.then(reject);
        })
    );
    const { vm, flush } = setupRemote(checkResources);
    vm.quality.run();
    flush();
    await tick();
    expect(vm.quality.remoteStatus()).toBe('running');

    vm.quality.cancel();
    await tick();

    expect(token.reason).toBeDefined();
    expect(vm.quality.remoteStatus()).toBe('idle');
    expect(vm.quality.status()).toBe('done');
    const statuses = vm.quality.checks().map((c) => c.status);
    expect(statuses).toContain('cancelled');
    expect(statuses).not.toContain('error');
    expect(vm.quality.passedCount()).toBe(1);
  });

  it('does not wait for a cancelled request before asking again', async () => {
    const checkResources = jest.fn(
      (_url, _resources, options) =>
        new Promise((resolve, reject) => {
          options.cancelToken.promise.then(reject);
        })
    );
    const { vm, flush } = setupRemote(checkResources);
    vm.quality.run();
    flush();
    await tick();
    vm.quality.cancel();
    vm.quality.run();
    flush();
    await tick();
    await tick();
    expect(checkResources).toHaveBeenCalledTimes(2);
  });

  it('aborts the request of the previous run when a new one starts', async () => {
    const tokens = [];
    const checkResources = jest.fn(
      (_url, _resources, options) =>
        new Promise((resolve, reject) => {
          tokens.push(options.cancelToken);
          options.cancelToken.promise.then(reject);
        })
    );
    const { vm, flush } = setupRemote(checkResources);
    vm.quality.run();
    flush();
    await tick();
    vm.quality.run();
    flush();
    await tick();
    await tick();
    expect(checkResources).toHaveBeenCalledTimes(2);
    expect(tokens[0].reason).toBeDefined();
    expect(tokens[1].reason).toBeUndefined();
    expect(vm.quality.remoteStatus()).toBe('running');
  });

  it('tells a user who ran too many checks apart from a failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const tooFrequent = {
      response: {
        status: 429,
        data: { message: 'QUALITY_CHECKS_TOO_FREQUENT' },
      },
    };
    const { vm, flush } = setupRemote(() => Promise.reject(tooFrequent));
    vm.quality.run();
    flush();
    await tick();

    expect(vm.quality.remoteStatus()).toBe('error');
    expect(vm.quality.remoteError()).toBe('too-frequent');

    const failed = setupRemote(() => Promise.reject(new Error('500')));
    failed.vm.quality.run();
    failed.flush();
    await tick();
    expect(failed.vm.quality.remoteError()).toBe('failed');
    console.error.mockRestore();
  });
});
