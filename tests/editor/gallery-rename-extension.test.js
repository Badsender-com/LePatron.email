/**
 * @jest-environment jsdom
 */
'use strict';

// US-11 — the Knockout side of the rename: the optimistic write, and the undo.

jest.mock('jquery', () => {
  const ajax = jest.fn();
  return { ajax, fn: {} };
});

const $ = require('jquery');
const ko = require('knockout');
const renameGalleryImage = require('../../packages/editor/src/js/ext/badsender-rename-gallery-image.js');

const MONGO_ID = '6a2135b7f802c2a6f99a4242';
const FILE = { name: `${MONGO_ID}-abc.png`, label: 'avant.png', url: 'x' };
const OTHER = { name: `${MONGO_ID}-def.png`, label: 'autre.png' };

function viewModel(files = [FILE, OTHER]) {
  const vm = {
    mailingGallery: ko.observableArray(files.map((f) => ({ ...f }))),
    notifier: { error: jest.fn(), success: jest.fn() },
    t: (key) => key,
  };
  renameGalleryImage(vm);
  return vm;
}

const accepted = () => Promise.resolve({});
const refused = () => Promise.reject(new Error('500'));

beforeEach(() => $.ajax.mockReset());

describe('renameImage — the request', () => {
  it('patches the label of the right image, under its gallery id', async () => {
    $.ajax.mockImplementation(accepted);
    const vm = viewModel();

    await vm.renameImage(vm.mailingGallery()[0], 'mailing', 'après.png');

    expect($.ajax).toHaveBeenCalledTimes(1);
    const call = $.ajax.mock.calls[0][0];
    expect(call.url).toBe(
      `/api/images/gallery/${MONGO_ID}/${encodeURIComponent(FILE.name)}/label`
    );
    expect(call.method).toBe('PATCH');
    expect(JSON.parse(call.data)).toEqual({ label: 'après.png' });
  });

  it('sanitises before sending, like the server will', async () => {
    $.ajax.mockImplementation(accepted);
    const vm = viewModel();

    await vm.renameImage(vm.mailingGallery()[0], 'mailing', '  après   nom  ');

    expect(JSON.parse($.ajax.mock.calls[0][0].data)).toEqual({
      label: 'après nom',
    });
  });

  it('says nothing when the label is unchanged, empty, or the file unknown', async () => {
    const vm = viewModel();

    await vm.renameImage(vm.mailingGallery()[0], 'mailing', 'avant.png');
    await vm.renameImage(vm.mailingGallery()[0], 'mailing', '   ');
    await vm.renameImage({ name: 'not-a-mongo-id.png' }, 'mailing', 'x.png');
    await vm.renameImage({ name: `${MONGO_ID}-gone.png` }, 'mailing', 'x.png');

    expect($.ajax).not.toHaveBeenCalled();
  });
});

describe('renameImage — the optimistic write', () => {
  // The grid mirrors this observable, so the new label has to land in it for
  // the user to see anything before the round-trip comes back.
  it('shows the new label before the server answers', () => {
    let settle;
    $.ajax.mockImplementation(
      () => new Promise((resolve) => (settle = resolve))
    );
    const vm = viewModel();

    vm.renameImage(vm.mailingGallery()[0], 'mailing', 'après.png');

    expect(vm.mailingGallery()[0].label).toBe('après.png');
    settle({});
  });

  // Knockout notifies on array operations, not on a property of an element:
  // mutating the object in place would leave the grid showing the old label.
  it('replaces the entry rather than mutating it', () => {
    let settle;
    $.ajax.mockImplementation(
      () => new Promise((resolve) => (settle = resolve))
    );
    const vm = viewModel();
    const before = vm.mailingGallery()[0];
    const seen = [];
    vm.mailingGallery.subscribe((files) => seen.push(files[0].label));

    vm.renameImage(before, 'mailing', 'après.png');

    expect(vm.mailingGallery()[0]).not.toBe(before);
    expect(before.label).toBe('avant.png');
    expect(seen).toContain('après.png');
    settle({});
  });

  it('leaves the other images alone', async () => {
    $.ajax.mockImplementation(accepted);
    const vm = viewModel();

    await vm.renameImage(vm.mailingGallery()[0], 'mailing', 'après.png');

    expect(vm.mailingGallery()).toHaveLength(2);
    expect(vm.mailingGallery()[1].label).toBe('autre.png');
  });

  it('keeps the new label once the server accepts', async () => {
    $.ajax.mockImplementation(accepted);
    const vm = viewModel();

    const ok = await vm.renameImage(
      vm.mailingGallery()[0],
      'mailing',
      'après.png'
    );

    expect(ok).toBe(true);
    expect(vm.mailingGallery()[0].label).toBe('après.png');
    expect(vm.notifier.error).not.toHaveBeenCalled();
  });
});

describe('renameImage — the undo', () => {
  it('puts the old label back when the server refuses', async () => {
    $.ajax.mockImplementation(refused);
    const vm = viewModel();

    const ok = await vm.renameImage(
      vm.mailingGallery()[0],
      'mailing',
      'après.png'
    );

    expect(ok).toBe(false);
    expect(vm.mailingGallery()[0].label).toBe('avant.png');
  });

  it('tells the user rather than silently reverting', async () => {
    $.ajax.mockImplementation(refused);
    const vm = viewModel();

    await vm.renameImage(vm.mailingGallery()[0], 'mailing', 'après.png');

    expect(vm.notifier.error).toHaveBeenCalledWith('gallery-rename-image-fail');
  });

  // An upload can land while the request is in flight, which unshifts into the
  // array and moves every index.
  it('undoes by name, not by the index it started from', async () => {
    let settle;
    $.ajax.mockImplementation(
      () => new Promise((resolve, reject) => (settle = reject))
    );
    const vm = viewModel();
    const pending = vm.renameImage(
      vm.mailingGallery()[0],
      'mailing',
      'après.png'
    );

    vm.mailingGallery.unshift({
      name: `${MONGO_ID}-new.png`,
      label: 'neuve.png',
    });
    settle(new Error('500'));
    await pending;

    expect(vm.mailingGallery()[0].label).toBe('neuve.png');
    expect(vm.mailingGallery()[1].label).toBe('avant.png');
  });
});
