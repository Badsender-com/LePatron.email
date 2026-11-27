/**
 * @jest-environment jsdom
 */

'use strict';

// The modal says which elements will not be sent.
//
// A blank element — a text with no words, an image with no source, a button
// with no label — is drawn in the preview as its starter, and not sent
// (isBlankElement). Without a word about it, a block of starters looked done
// and applied as nothing. The element list marks each one "vide", and a status
// under the preview counts them.
//
// Through the French dictionary, as rows-panel.test.js does.

const Vue = require('vue/dist/vue.common');

const { open, unmountAll } = require('./modal-helpers.js');
const fr = require('../../../public/lang/badsender-fr.js');

const t = (key, params) =>
  Object.keys(params || {}).reduce(
    (text, name) => text.replace(new RegExp(`__${name}__`, 'g'), params[name]),
    fr[key] || key
  );

async function openWith(types) {
  const { modal } = open(null, { t, showDialogGallery: () => false });
  types.forEach((type) => modal.addElement(type));
  await Vue.nextTick();
  return modal;
}

const options = () =>
  Array.from(
    document.querySelectorAll('.bb-modal__list [role="option"]')
  ).map((option) => option.textContent.trim());
const status = () =>
  document.querySelector('.bb-modal__blank').textContent.trim();

afterEach(unmountAll);

describe('the element list', () => {
  it('marks a blank element', async () => {
    await openWith(['text', 'image', 'button', 'divider']);

    expect(options()).toEqual([
      'Texte — vide',
      'Image — vide',
      'Bouton — vide',
      'Séparateur',
    ]);
  });

  it('no longer marks it once filled', async () => {
    const modal = await openWith(['text', 'image']);
    const [text, image] = modal.columnElements;
    text.content = '<p>Bonjour</p>';
    image.src = 'https://example.test/a.png';
    await Vue.nextTick();

    expect(options()).toEqual(['Texte — Bonjour', 'Image']);
  });
});

describe('the status under the preview', () => {
  it('counts the blank elements', async () => {
    await openWith(['text', 'button', 'divider']);

    expect(status()).toBe(
      fr['block-builder-blank-elements'].replace('__count__', 2)
    );
  });

  it('says one', async () => {
    await openWith(['button']);

    expect(status()).toBe(fr['block-builder-blank-elements-one']);
  });

  // In the DOM all along, empty: a status region inserted with its message
  // is not reliably announced.
  it('is empty when every element holds something', async () => {
    const modal = await openWith(['divider', 'button']);
    modal.columnElements[1].label = 'Acheter';
    await Vue.nextTick();

    expect(status()).toBe('');
    expect(
      document.querySelector('.bb-modal__blank').getAttribute('role')
    ).toBe('status');
  });
});
