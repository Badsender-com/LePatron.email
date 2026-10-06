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
} = require('../../../packages/editor/src/js/ext/badsender-control-quality.js');

const viewModel = { t: (key) => key };

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
