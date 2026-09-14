'use strict';

// The mixin is a plain options object, so its computeds and methods can be
// exercised against a fake instance — no component mounting (the repo has no
// @vue/test-utils). What matters here is the state contract that the version
// panels rely on: edits live in the drafts, never in the prop, and they are
// only discarded when the server document itself moved on.
const mixin = require('../../../packages/ui/helpers/mixins/mixin-version-drafts')
  .default;

const FIELDS = ['body', 'examplesGood', 'changelog'];

function makeVm({ versions = [], activeVersion = null, fields = FIELDS } = {}) {
  const vm = {
    versionsSource: versions,
    activeVersionRef: activeVersion,
    editableVersionFields: fields,
    versionDrafts: {},
    emitted: [],
    $t: (key) => key,
    $emit(name, payload) {
      this.emitted.push([name, payload]);
    },
  };
  Object.entries(mixin.methods).forEach(([name, fn]) => {
    vm[name] = fn.bind(vm);
  });
  Object.entries(mixin.computed).forEach(([name, fn]) => {
    Object.defineProperty(vm, name, { get: fn.bind(vm), configurable: true });
  });
  vm.$emit = vm.$emit.bind(vm);
  vm.syncVersionDrafts();
  return vm;
}

const version = (over = {}) => ({
  versionMajor: 1,
  versionMinor: 0,
  status: 'DRAFT',
  updatedAt: '2026-08-01T10:00:00.000Z',
  body: 'initial body',
  examplesGood: ['a'],
  changelog: '',
  ...over,
});

describe('sortedVersions / hasActive', () => {
  it('sorts newest version first', () => {
    const vm = makeVm({
      versions: [
        version({ versionMajor: 1, versionMinor: 1 }),
        version({ versionMajor: 2, versionMinor: 0 }),
        version({ versionMajor: 1, versionMinor: 0 }),
      ],
    });
    expect(
      vm.sortedVersions.map((v) => `${v.versionMajor}.${v.versionMinor}`)
    ).toEqual(['2.0', '1.1', '1.0']);
  });

  it('reports an active version only when one is set', () => {
    expect(makeVm({ versions: [version()] }).hasActive).toBe(false);
    expect(makeVm({ activeVersion: {} }).hasActive).toBe(false);
    expect(makeVm({ activeVersion: { major: 1, minor: 0 } }).hasActive).toBe(
      true
    );
  });
});

describe('drafts', () => {
  it('copies the editable fields and detaches arrays from the prop', () => {
    const v = version();
    const vm = makeVm({ versions: [v] });
    const draft = vm.draftFor(v);

    expect(draft.body).toBe('initial body');
    draft.examplesGood.push('b');
    expect(v.examplesGood).toEqual(['a']);
  });

  it('never writes into the version it came from', () => {
    const v = version();
    const vm = makeVm({ versions: [v] });
    vm.draftFor(v).body = 'edited';

    expect(v.body).toBe('initial body');
    expect(vm.mergedVersion(v).body).toBe('edited');
  });

  it('keeps pending edits when the parent re-renders with the same version', () => {
    const v = version();
    const vm = makeVm({ versions: [v] });
    vm.draftFor(v).body = 'being typed';

    // The details form emits a fresh entity object on every keystroke: same
    // server document, new array identity.
    vm.versionsSource = [{ ...v }];
    vm.syncVersionDrafts();

    expect(vm.draftFor(v).body).toBe('being typed');
  });

  it('rebuilds the draft when the server version moved on', () => {
    const v = version();
    const vm = makeVm({ versions: [v] });
    vm.draftFor(v).body = 'stale edit';

    const saved = version({
      body: 'saved body',
      updatedAt: '2026-08-02T10:00:00.000Z',
    });
    vm.versionsSource = [saved];
    vm.syncVersionDrafts();

    expect(vm.draftFor(saved).body).toBe('saved body');
  });

  it('tracks drafts per version', () => {
    const a = version({ versionMajor: 1, versionMinor: 0, body: 'a' });
    const b = version({ versionMajor: 2, versionMinor: 0, body: 'b' });
    const vm = makeVm({ versions: [a, b] });
    vm.draftFor(a).body = 'edited a';

    expect(vm.draftFor(b).body).toBe('b');
    expect(vm.isVersionDirty(a)).toBe(true);
    expect(vm.isVersionDirty(b)).toBe(false);
  });
});

describe('isVersionDirty', () => {
  it('is false on an untouched draft', () => {
    const v = version();
    expect(makeVm({ versions: [v] }).isVersionDirty(v)).toBe(false);
  });

  it('detects a changed scalar and a changed array', () => {
    const v = version();
    const vm = makeVm({ versions: [v] });
    vm.draftFor(v).changelog = 'why';
    expect(vm.isVersionDirty(v)).toBe(true);

    const other = version({ versionMajor: 3 });
    const vm2 = makeVm({ versions: [other] });
    vm2.draftFor(other).examplesGood = ['a', 'b'];
    expect(vm2.isVersionDirty(other)).toBe(true);
  });

  it('treats undefined and null as the same absence', () => {
    const v = version({ changelog: undefined });
    const vm = makeVm({ versions: [v] });
    vm.draftFor(v).changelog = null;
    expect(vm.isVersionDirty(v)).toBe(false);
  });

  it('ignores fields outside the editable set', () => {
    const v = version({ status: 'DRAFT' });
    const vm = makeVm({ versions: [v] });
    vm.draftFor(v).status = 'ACTIVE';
    expect(vm.isVersionDirty(v)).toBe(false);
    expect(vm.mergedVersion(v).status).toBe('DRAFT');
  });
});

describe('emits', () => {
  it('hands the merged version to save', () => {
    const v = version();
    const vm = makeVm({ versions: [v] });
    vm.draftFor(v).body = 'edited';
    vm.emitSaveVersion(v);

    expect(vm.emitted).toEqual([
      ['save', { version: { ...v, body: 'edited' } }],
    ]);
  });

  // The whole point of R-04: the page needs to know a publish carries unsaved
  // work, so it can persist it before activating.
  it('flags an unsaved draft when publishing', () => {
    const v = version();
    const vm = makeVm({ versions: [v] });
    vm.emitActivateVersion(v);
    expect(vm.emitted[0][1].dirty).toBe(false);

    vm.draftFor(v).body = 'edited';
    vm.emitActivateVersion(v);
    expect(vm.emitted[1][1]).toEqual({
      version: { ...v, body: 'edited' },
      dirty: true,
    });
  });
});
