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
