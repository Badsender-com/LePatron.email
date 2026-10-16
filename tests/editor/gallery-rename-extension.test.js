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
// jQuery rejects with a jqXHR object, not an Error
const jqXHR = (status) =>
  Object.assign(new Error(`HTTP ${status}`), { status });
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

  it('sends nothing, and says nothing, when the label is unchanged', async () => {
    const vm = viewModel();
    await vm.renameImage(vm.mailingGallery()[0], 'mailing', 'avant.png');
    expect($.ajax).not.toHaveBeenCalled();
    expect(vm.notifier.error).not.toHaveBeenCalled();
  });

  it('sends nothing, and says nothing, for an empty label', async () => {
    const vm = viewModel();
    await vm.renameImage(vm.mailingGallery()[0], 'mailing', '   ');
    expect($.ajax).not.toHaveBeenCalled();
    expect(vm.notifier.error).not.toHaveBeenCalled();
  });

  // These two are failures, not no-ops, and used to pass in silence — the user
  // watched the new name vanish with no explanation. Pre-V1 images are exactly
  // the ones whose stored name may not follow the convention, and repairing
  // their labels is what this story is for.
  it('tells the user when the file name does not carry a gallery id', async () => {
    const vm = viewModel();
    const ok = await vm.renameImage(
      { name: 'not-a-mongo-id.png' },
      'mailing',
      'x.png'
    );
    expect(ok).toBe(false);
    expect($.ajax).not.toHaveBeenCalled();
    expect(vm.notifier.error).toHaveBeenCalledWith(
      'gallery-rename-image-unsupported'
    );
  });

  it('tells the user when the image is no longer in the gallery', async () => {
    const vm = viewModel();
    const ok = await vm.renameImage(
      { name: `${MONGO_ID}-gone.png` },
      'mailing',
      'x.png'
    );
    expect(ok).toBe(false);
    expect($.ajax).not.toHaveBeenCalled();
    expect(vm.notifier.error).toHaveBeenCalledWith('gallery-rename-image-gone');
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

describe('renameImage — the server has the last word', () => {
  // The controller answers with the file as it stored it, precisely so the
  // editor can push it back. Ignoring it left the grid on our own guess.
  it('takes the stored file from the response rather than its own guess', async () => {
    $.ajax.mockImplementation(() =>
      Promise.resolve({
        name: FILE.name,
        label: 'normalise par le serveur.png',
        uploadedAt: '2026-10-10T00:00:00.000Z',
      })
    );
    const vm = viewModel();

    await vm.renameImage(vm.mailingGallery()[0], 'mailing', 'ce que je tape');

    expect(vm.mailingGallery()[0].label).toBe('normalise par le serveur.png');
    expect(vm.mailingGallery()[0].uploadedAt).toBe('2026-10-10T00:00:00.000Z');
  });

  it('maps the refusal to a message that says which refusal it was', async () => {
    const cases = [
      [400, 'gallery-rename-image-invalid'],
      [422, 'gallery-rename-image-invalid'],
      [403, 'gallery-rename-image-forbidden'],
      [404, 'gallery-rename-image-gone'],
      [500, 'gallery-rename-image-fail'],
    ];
    for (const [status, key] of cases) {
      $.ajax.mockImplementation(() => Promise.reject(jqXHR(status)));
      const vm = viewModel();
      // eslint-disable-next-line no-await-in-loop
      await vm.renameImage(vm.mailingGallery()[0], 'mailing', 'apres.png');
      expect(vm.notifier.error).toHaveBeenCalledWith(key);
    }
  });

  it('gives up on a hung request instead of leaving the label hanging', async () => {
    $.ajax.mockImplementation(accepted);
    const vm = viewModel();
    await vm.renameImage(vm.mailingGallery()[0], 'mailing', 'apres.png');
    expect($.ajax.mock.calls[0][0].timeout).toBeGreaterThan(0);
  });
});

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
  // what was there before the whole burst — not to the intermediate value our
  // own first request optimistically wrote.
  it('reverts to the label from before the burst, not to its own guess', async () => {
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

    expect(vm.mailingGallery()[0].label).toBe('avant.png');
    expect(vm.notifier.error).toHaveBeenCalledWith('gallery-rename-image-fail');
  });
});
