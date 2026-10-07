/**
 * @jest-environment jsdom
 */

'use strict';

// The export quality check lists the links still pointing at `#toreplace`,
// quoting their label. That label is the email's own content, read through
// `textContent` — which decodes entities — so it was markup by the time it
// reached `$(\`<li>${error}</li>\`)`, built in the editor's document. An HTML
// code block can put any label on a link, so the check had to print it as text.

const $ = require('jquery');

const {
  displayErrors,
  getErrorsForControlQuality,
} = require('../../../packages/editor/src/js/ext/badsender-control-quality.js');
const { fakeViewModel, exportOf } = require('./fake-view-model');

const viewModel = { t: (key) => key };

describe('getErrorsForControlQuality', () => {
  it('lists the findings as translated lines, prefixed by their block', () => {
    const vm = fakeViewModel({
      blocks: [{ id: 'b1', type: 'titleBlock' }],
      html: exportOf({ b1: '<a href="#toreplace">Read more</a>' }),
    });

    expect(getErrorsForControlQuality(vm)).toEqual([
      'Title · Link not filled in: Read more',
    ]);
  });

  it('checks the HTML it is given instead of exporting again', () => {
    const vm = fakeViewModel();
    getErrorsForControlQuality(vm, { html: '<p></p>' });
    expect(vm.exportHTML).not.toHaveBeenCalled();
  });
});

beforeEach(() => {
  document.body.innerHTML = '<replacedbody></replacedbody>';
});

afterEach(() => {
  delete window.pwned;
});

describe('displayErrors', () => {
  it('prints a quoted label as text, never as markup', () => {
    const label =
      'Missing link label: <img src="x" onerror="window.pwned = 1">';

    displayErrors([label], viewModel);

    const item = $('.error-message li');
    expect(item.text()).toBe(label);
    expect(item.find('img')).toHaveLength(0);
    expect(window.pwned).toBeUndefined();
  });

  it('lists every error', () => {
    displayErrors(['a', 'b'], viewModel);
    expect($('.error-message li')).toHaveLength(2);
  });
});
