/**
 * @jest-environment jsdom
 */
'use strict';

// Deleting a gallery image asks first.
//
// The delete button is one of three 24px icons that appear under the pointer
// when a thumbnail is hovered (US-08), so a mis-click is easy and the result
// is not something the interface can undo.

const $ = require('jquery');
const ko = require('knockout');
const removeGalleryImage = require('../../packages/editor/src/js/ext/badsender-remove-gallery-image.js');
const {
  GALLERY_REQUEST_TIMEOUT_MS,
} = require('../../packages/editor/src/js/ext/gallery-request.js');
// the real strings, so a key that exists nowhere fails here rather than
// reaching a user as its own name
const FR = require('../../public/lang/badsender-fr.js');

const FILE = {
  name: '507f1f77bcf86cd799439011-aaa.png',
  label: 'mon image.png',
  deleteUrl: '/api/images/507f1f77bcf86cd799439011-aaa.png',
};

let viewModel;
let requests;

function makeViewModel(files) {
  return {
    mailingGallery: ko.observableArray(files),
    mailingGalleryStatus: ko.observable(files.length),
    notifier: { success: jest.fn(), error: jest.fn() },
    // mosaico's own `tt`, reproduced faithfully — the `String.replace(regex,
    // value)` form, not `split().join()`. It has to be the real form: `replace`
    // interprets `$&`, `` $` `` and `$'` in the replacement value, so a label
    // containing one of those renders differently from a naive substitution.
    // A stub that diverged here could pass while production mangled the name.
    t: (key, params) => {
      let out = FR[key];
      if (out === undefined) throw new Error(`missing translation: ${key}`);
      Object.keys(params || {}).forEach((name) => {
        out = out.replace(new RegExp(`__${name}__`, 'g'), params[name]);
      });
      return out;
    },
  };
}

beforeEach(() => {
  requests = [];
  $.ajax = (settings) => {
    requests.push(settings);
    return settings;
  };
  viewModel = makeViewModel([FILE]);
  removeGalleryImage(viewModel);
});

afterEach(() => {
  delete window.confirm;
});

describe('deleting a gallery image', () => {
  it('asks before deleting anything', () => {
    window.confirm = jest.fn().mockReturnValue(true);

    viewModel.removeImage(FILE, 'mailing');

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(FILE.deleteUrl);
  });

  it('sends nothing at all when the answer is no', () => {
    window.confirm = jest.fn().mockReturnValue(false);

    viewModel.removeImage(FILE, 'mailing');

    expect(requests).toHaveLength(0);
    expect(viewModel.mailingGallery()).toHaveLength(1);
  });

  // The button that opened it is an unlabelled icon, and the pointer may have
  // moved on by the time the dialog is read.
  it('names the image it is about to remove', () => {
    window.confirm = jest.fn().mockReturnValue(false);

    viewModel.removeImage(FILE, 'mailing');

    expect(window.confirm.mock.calls[0][0]).toContain('mon image.png');
  });

  it('falls back to the stored name when the image has no label', () => {
    window.confirm = jest.fn().mockReturnValue(false);

    viewModel.removeImage({ ...FILE, label: null }, 'mailing');

    expect(window.confirm.mock.calls[0][0]).toContain(FILE.name);
  });

  // Removal takes the image out of the gallery list; the stored file stays
  // where it is, on purpose, so emails already built with it keep working.
  // A dialog that overstated the stakes would be its own kind of wrong.
  it('says what is not at stake, not only what is', () => {
    window.confirm = jest.fn().mockReturnValue(false);

    viewModel.removeImage(FILE, 'mailing');

    const message = window.confirm.mock.calls[0][0];
    expect(message).toContain('de la galerie');
    expect(message).toContain("Les emails qui l'utilisent déjà");
    // no leftover placeholder reaching a user
    expect(message).not.toContain('__');
  });
});

describe('deleting a gallery image — when the request fails', () => {
  beforeEach(() => {
    window.confirm = jest.fn().mockReturnValue(true);
  });

  // A stalled connection used to leave the thumbnail in place with no error
  // and no way to tell whether the delete went through.
  it('gives the request a timeout', () => {
    viewModel.removeImage(FILE, 'mailing');

    expect(requests[0].timeout).toBe(GALLERY_REQUEST_TIMEOUT_MS);
  });

  it('tells the user when the delete is refused, and keeps the image', () => {
    // drive the error branch jQuery would call
    $.ajax = (settings) => {
      settings.error({ status: 500 }, 'error');
      return settings;
    };

    viewModel.removeImage(FILE, 'mailing');

    // `t` resolves the key to its French string here, so assert an error was
    // shown and the image survived, not the raw key
    expect(viewModel.notifier.error).toHaveBeenCalledTimes(1);
    expect(viewModel.mailingGallery()).toHaveLength(1);
  });

  it('tells the user when the delete times out', () => {
    $.ajax = (settings) => {
      settings.error({ status: 0 }, 'timeout');
      return settings;
    };

    viewModel.removeImage(FILE, 'mailing');

    expect(viewModel.notifier.error).toHaveBeenCalled();
    expect(viewModel.mailingGallery()).toHaveLength(1);
  });
});
