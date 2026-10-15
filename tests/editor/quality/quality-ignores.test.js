/**
 * @jest-environment jsdom
 */

'use strict';

const ko = require('knockout');
const {
  installQualityReview,
} = require('../../../packages/editor/src/js/ext/quality/quality-review.js');
const {
  commentDraftFor,
} = require('../../../packages/editor/src/js/vue/components/quality-drawer/quality-actions.js');

const URL = '/api/mailings/m1/quality-ignores';
const finding = (fingerprint, severity = 'error') => ({
  fingerprint,
  ruleId: 'unfilled-links',
  severity,
});

function setup({ ignored = [], persist, url = URL } = {}) {
  const vm = {
    t: (key) => key,
    notifier: { error: jest.fn() },
    exportHTML: () => '<p></p>',
    metadata: { url: { qualityIgnores: url }, qualityIgnores: ignored },
  };
  const result = {
    findings: [finding('a'), finding('b', 'warning')],
    checks: [],
  };
  installQualityReview(vm, ko, {
    run: () => result,
    defer: (fn) => fn(),
    watchContent: () => () => {},
    persist:
      persist ||
      jest.fn((_url, change) => Promise.resolve(change.ignored ? ['a'] : [])),
  });
  vm.quality.run();
  return vm;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ignored findings', () => {
  it('starts from what the email stores, and keeps them out of the counts', () => {
    const vm = setup({ ignored: ['a'] });
    expect(vm.quality.activeFindings().map((f) => f.fingerprint)).toEqual([
      'b',
    ]);
    expect(vm.quality.ignoredFindings().map((f) => f.fingerprint)).toEqual([
      'a',
    ]);
    expect(vm.quality.errorCount()).toBe(0);
    expect(vm.quality.issueCount()).toBe(1);
  });

  it('ignores at once and stores the change, by fingerprint alone', async () => {
    const persist = jest.fn(() => Promise.resolve(['a']));
    const vm = setup({ persist });

    vm.quality.ignore(finding('a'));
    expect(vm.quality.ignored()).toEqual(['a']);
    await flush();

    expect(persist).toHaveBeenCalledWith(URL, {
      fingerprint: 'a',
      ignored: true,
    });
  });

  it('puts things back, and says so, when storing fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const vm = setup({
      persist: jest.fn(() => Promise.reject(new Error('500'))),
    });

    vm.quality.ignore(finding('a'));
    await flush();

    expect(vm.quality.ignored()).toEqual([]);
    expect(vm.notifier.error).toHaveBeenCalledWith(
      'The change could not be saved'
    );
    console.error.mockRestore();
  });

  it('releases an ignored finding', async () => {
    const persist = jest.fn(() => Promise.resolve([]));
    const vm = setup({ ignored: ['a'], persist });

    vm.quality.unignore(finding('a'));
    await flush();

    expect(vm.quality.ignored()).toEqual([]);
    expect(persist).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({ ignored: false })
    );
  });

  it('sends two quick changes one after the other, and keeps both meanwhile', async () => {
    const answers = [];
    const persist = jest.fn(
      () =>
        new Promise((resolve) => {
          answers.push(resolve);
        })
    );
    const vm = setup({ persist });

    vm.quality.ignore(finding('a'));
    vm.quality.ignore(finding('b'));
    expect(vm.quality.ignored()).toEqual(['a', 'b']);
    await flush();
    // The second waits for the first: the server rewrites the whole list.
    expect(persist).toHaveBeenCalledTimes(1);

    // The first answer knows nothing of "b": it must not erase it.
    answers[0](['a']);
    await flush();
    expect(vm.quality.ignored()).toEqual(['a', 'b']);
    expect(persist).toHaveBeenCalledTimes(2);

    // The last answer carries everyone's choices, including another user's.
    answers[1](['a', 'b', 'c']);
    await flush();
    expect(vm.quality.ignored()).toEqual(['a', 'b', 'c']);
  });

  it('puts back only the change that failed, and goes on with the next', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    let call = 0;
    const persist = jest.fn(() =>
      ++call === 1 ? Promise.reject(new Error('500')) : Promise.resolve(['b'])
    );
    const vm = setup({ persist });

    vm.quality.ignore(finding('a'));
    vm.quality.ignore(finding('b'));
    await flush();
    await flush();

    expect(vm.quality.ignored()).toEqual(['b']);
    expect(persist).toHaveBeenCalledTimes(2);
    console.error.mockRestore();
  });

  it('cannot ignore anything without the endpoint, and says so to the drawer', () => {
    const vm = setup({ url: null });
    expect(vm.quality.canIgnore).toBe(false);
    vm.quality.ignore(finding('a'));
    expect(vm.quality.ignored()).toEqual([]);

    expect(setup().quality.canIgnore).toBe(true);
  });

  it('does not open the drawer on export when every finding is ignored', () => {
    const vm = setup({ ignored: ['a', 'b'] });
    vm.showQuality(false);
    vm.quality.review();
    expect(vm.showQuality()).toBe(false);
  });
});

describe('commentDraftFor', () => {
  it('turns a finding into a comment in its own terms', () => {
    const item = {
      title: 'Links',
      description: 'Link not filled in: Buy now',
      finding: { blockId: 'b1', severity: 'error', category: 'content' },
    };
    expect(commentDraftFor(item, (key) => key)).toEqual({
      blockId: 'b1',
      text: 'Quality control · Links : Link not filled in: Buy now',
      severity: 'blocking',
      category: 'content',
    });
  });

  it('maps an accessibility warning to a design comment', () => {
    const item = {
      title: 'Contrast',
      description: 'Too low',
      finding: {
        blockId: null,
        severity: 'warning',
        category: 'accessibility',
      },
    };
    expect(commentDraftFor(item, (key) => key)).toMatchObject({
      blockId: null,
      severity: 'important',
      category: 'design',
    });
  });
});
