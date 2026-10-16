/**
 * @jest-environment jsdom
 */
'use strict';

// Loading the gallery list, and what happens when that fetch fails.
//
// The list fetch is the one request that used to have neither a timeout nor a
// test: a stalled connection left the panel stuck on "loading…" with no error
// and no way back.

const $ = require('jquery');
const ko = require('knockout');
const galleryLoader = require('../../packages/editor/src/js/ext/badsender-gallery.js');

const URL = {
  mailing: '/api/images/gallery/abc',
  template: '/api/images/gallery/def',
};

let viewModel;
let ajaxArgs;

function build() {
  const vm = {
    showGallery: ko.observable(false),
    selectedImageTab: ko.observable(0),
    notifier: { success: jest.fn(), error: jest.fn() },
    t: (key) => key,
    remoteFileProcessor: (file) => file,
  };
  galleryLoader({ fileuploadConfig: { url: URL } })(vm);
  return vm;
}

// A jqXHR-shaped stand-in: `$.ajax` returns an object with chainable
// done/fail, and the test decides which one fires.
function ajaxResolving(data) {
  $.ajax = (args) => {
    ajaxArgs = args;
    return {
      done(cb) {
        cb(data);
        return this;
      },
      fail() {
        return this;
      },
    };
  };
}

function ajaxFailing() {
  $.ajax = (args) => {
    ajaxArgs = args;
    return {
      done() {
        return this;
      },
      fail(cb) {
        // jQuery's fail signature is (jqXHR, textStatus); the lint rule reads
        // the first arg as a Node-style error, which it is not here
        const jqXHR = { status: 0 };
        cb(jqXHR, 'timeout');
        return this;
      },
    };
  };
}

beforeEach(() => {
  ajaxArgs = null;
  viewModel = build();
});

describe('loading the gallery list', () => {
  it('fills the gallery and the count on success', () => {
    ajaxResolving({ files: [{ name: 'a.png' }, { name: 'b.png' }] });

    viewModel.loadMailingGallery();

    expect(viewModel.mailingGalleryStatus()).toBe(2);
    expect(viewModel.mailingGallery()).toHaveLength(2);
  });

  it('carries a timeout, so a stalled fetch cannot strand the panel', () => {
    ajaxResolving({ files: [] });

    viewModel.loadMailingGallery();

    expect(ajaxArgs.timeout).toBeGreaterThan(0);
  });

  // The failure the timeout exists for: status goes back to `false` (so the
  // "Load gallery" button returns and the user can retry) and an error is
  // shown, rather than a silent, permanent "loading…".
  it('reports the failure and returns to a retryable state', () => {
    ajaxFailing();

    viewModel.loadMailingGallery();

    expect(viewModel.mailingGalleryStatus()).toBe(false);
    expect(viewModel.notifier.error).toHaveBeenCalledWith(
      'Unexpected error listing files'
    );
  });
});

// What a caller outside the panel needs, the pencil on an image of the email
// first: the list, whether or not the gallery was ever opened in this editor.
describe('waiting for a loaded gallery', () => {
  it('answers the list at once when it is already loaded', async () => {
    ajaxResolving({ files: [{ name: 'a.png' }] });
    viewModel.loadMailingGallery();
    const calls = jest.fn();
    $.ajax = calls;

    await expect(viewModel.loadedGallery('mailing')).resolves.toEqual([
      { name: 'a.png' },
    ]);
    expect(calls).not.toHaveBeenCalled();
  });

  it('loads a gallery never opened, then answers its files', async () => {
    ajaxResolving({ files: [{ name: 'a.png' }, { name: 'b.png' }] });

    const files = await viewModel.loadedGallery('template');

    expect(ajaxArgs.url).toBe(URL.template);
    expect(files.map((file) => file.name)).toEqual(['b.png', 'a.png']);
    expect(viewModel.templateGalleryStatus()).toBe(2);
  });

  it('waits for a load already under way rather than starting another', async () => {
    const calls = jest.fn();
    $.ajax = calls;
    viewModel.mailingGalleryStatus('loading');

    const pending = viewModel.loadedGallery('mailing');
    viewModel.mailingGallery([{ name: 'a.png' }]);
    viewModel.mailingGalleryStatus(1);

    await expect(pending).resolves.toEqual([{ name: 'a.png' }]);
    expect(calls).not.toHaveBeenCalled();
  });

  it('answers null when the load fails', async () => {
    ajaxFailing();

    await expect(viewModel.loadedGallery('mailing')).resolves.toBeNull();
  });
});
