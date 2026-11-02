/**
 * @jest-environment jsdom
 */
'use strict';

// The Knockout side of a rename when requests overlap or never answer: two
// renames of one image, a burst that fails, an image deleted meanwhile, a
// timeout.

jest.mock('jquery', () => {
  const ajax = jest.fn();
  return { ajax, fn: {} };
});

const $ = require('jquery');
const ko = require('knockout');
const { userOfRole } = require('./helpers/current-user.js');
const {
  FILE,
  OTHER,
  viewModel,
  jqXHR,
} = require('./helpers/rename-extension.js');

beforeEach(() => $.ajax.mockReset());

describe('renameImage — two renames of the same image', () => {
  function deferred() {
    let settle;
    const promise = new Promise((resolve, reject) => {
      settle = { resolve, reject };
    });
    return { promise, settle };
  }

  // The first request's failure used to restore the label captured when IT
  // started — undoing a second rename the user had already made, and claiming
  // "the previous one was restored" about a value that had succeeded.
  it('ignores an older failure once a newer rename has landed', async () => {
    const first = deferred();
    const second = deferred();
    $.ajax
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const vm = viewModel();

    const p1 = vm.renameImage(vm.mailingGallery()[0], 'mailing', 'B.png');
    const p2 = vm.renameImage(vm.mailingGallery()[0], 'mailing', 'C.png');

    second.settle.resolve({ name: FILE.name, label: 'C.png' });
    await p2;
    first.settle.reject(jqXHR(500));
    await p1;

    expect(vm.mailingGallery()[0].label).toBe('C.png');
    expect(vm.notifier.error).not.toHaveBeenCalled();
  });

  // And when the newest one is the one that fails, the revert goes back to
  // the last label the server accepted: here the first rename of the burst,
  // not the label from before it, which the server no longer holds.
  it('reverts to the last label the server accepted', async () => {
    const first = deferred();
    const second = deferred();
    $.ajax
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const vm = viewModel();

    const p1 = vm.renameImage(vm.mailingGallery()[0], 'mailing', 'B.png');
    const p2 = vm.renameImage(vm.mailingGallery()[0], 'mailing', 'C.png');

    first.settle.resolve({ name: FILE.name, label: 'B.png' });
    await p1;
    second.settle.reject(jqXHR(500));
    await p2;

    expect(vm.mailingGallery()[0].label).toBe('B.png');
    expect(vm.notifier.error).toHaveBeenCalledWith('gallery-rename-image-fail');
  });
});

describe('renameImage — a burst where every rename fails', () => {
  it('reverts to the label from before the burst, not to its own guess', async () => {
    let rejectFirst;
    let rejectSecond;
    $.ajax
      .mockImplementationOnce(
        () => new Promise((resolve, reject) => (rejectFirst = reject))
      )
      .mockImplementationOnce(
        () => new Promise((resolve, reject) => (rejectSecond = reject))
      );
    const vm = viewModel();

    const p1 = vm.renameImage(vm.mailingGallery()[0], 'mailing', 'B.png');
    const p2 = vm.renameImage(vm.mailingGallery()[0], 'mailing', 'C.png');
    rejectFirst(jqXHR(500));
    await p1;
    rejectSecond(jqXHR(500));
    await p2;

    expect(vm.mailingGallery()[0].label).toBe('avant.png');
  });
});

describe('renameImage — the image disappears meanwhile', () => {
  // deleted from this editor while the rename was on its way
  it('announces nothing when the image left the list during the request', async () => {
    let settle;
    $.ajax.mockImplementation(
      () => new Promise((resolve) => (settle = resolve))
    );
    const vm = viewModel();
    const pending = vm.renameImage(
      vm.mailingGallery()[0],
      'mailing',
      'après.png'
    );

    vm.mailingGallery.remove((file) => file.name === FILE.name);
    settle({ name: FILE.name, label: 'après.png' });

    await expect(pending).resolves.toBe(false);
    expect(vm.mailingGallery().map((file) => file.name)).toEqual([OTHER.name]);
  });

  // deleted by someone else: putting it back would leave a thumbnail whose
  // every action fails
  it('takes the image out when the server no longer has it', async () => {
    $.ajax.mockImplementation(() => Promise.reject(jqXHR(404)));
    const vm = viewModel();
    vm.mailingGalleryStatus = ko.observable(2);

    const ok = await vm.renameImage(
      vm.mailingGallery()[0],
      'mailing',
      'après.png'
    );

    expect(ok).toBe(false);
    expect(vm.mailingGallery().map((file) => file.name)).toEqual([OTHER.name]);
    expect(vm.mailingGalleryStatus()).toBe(1);
    expect(vm.notifier.error).toHaveBeenCalledWith('gallery-rename-image-gone');
  });
});

// Past the time budget, the PATCH may still have been applied. Saying the old
// label is back would be a guess; the gallery is reloaded instead.
describe('renameImage — no answer in time', () => {
  const timeout = () =>
    Promise.reject(Object.assign(jqXHR(0), { statusText: 'timeout' }));

  it.each([
    ['mailing', 'loadMailingGallery'],
    ['template', 'loadTemplateGallery'],
  ])('says it cannot tell, and reloads the %s gallery', async (type, load) => {
    $.ajax.mockImplementation(timeout);
    const vm = viewModel();
    vm.templateGallery = vm.mailingGallery;
    // the template's labels are the platform's to rename
    vm.currentUser = userOfRole('super_admin');
    vm.loadMailingGallery = jest.fn();
    vm.loadTemplateGallery = jest.fn();

    const ok = await vm.renameImage(vm.mailingGallery()[0], type, 'après.png');

    expect(ok).toBe(false);
    expect(vm[load]).toHaveBeenCalledTimes(1);
    expect(vm.notifier.error).toHaveBeenCalledWith(
      'gallery-request-unconfirmed'
    );
    expect(vm.notifier.error).not.toHaveBeenCalledWith(
      'gallery-rename-image-fail'
    );
  });
});
