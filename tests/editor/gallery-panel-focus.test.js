/**
 * @jest-environment jsdom
 */
'use strict';

// Where the keyboard focus goes when a thumbnail it was on goes away. The
// trash button leaves the DOM with its thumbnail, and the focus then fell to
// the page's body: a keyboard user started over from the top of the editor.
jest.mock('jquery-ui/ui/widgets/draggable', () => ({}), { virtual: true });

const Vue = require('vue/dist/vue.common');
const {
  mountGrid,
  thumbOf,
  unmountGrid,
} = require('./helpers/gallery-grid.js');

const IMAGES = [
  { name: 'a-1.jpg', label: 'un.jpg', uploadedAt: '2026-03-01' },
  { name: 'a-2.png', label: 'deux.png', uploadedAt: '2026-02-01' },
  { name: 'a-3.png', label: 'trois.png', uploadedAt: '2026-01-01' },
];

let vm;
let panel;

// the extension, confirmed: the image leaves the Knockout list
function deleting(answer = true) {
  return (file) => {
    if (answer) vm.mailingGallery.remove((f) => f.name === file.name);
    return Promise.resolve(answer);
  };
}

async function deleteFromKeyboard(name) {
  const trash = thumbOf(panel, name).querySelector('[data-gallery-remove]');
  trash.focus();
  trash.click();
  // the request, then the grid's own re-render
  await Promise.resolve();
  await Vue.nextTick();
  await Vue.nextTick();
  await Vue.nextTick();
}

const pickOf = (name) =>
  thumbOf(panel, name).querySelector('[data-gallery-pick]');

beforeEach(async () => {
  ({ vm, panel } = await mountGrid(IMAGES));
  vm.removeImage.mockImplementation(deleting());
});

afterEach(() => unmountGrid(panel));

describe('gallery panel — the focus after a delete', () => {
  it('goes to the image that takes the deleted one’s place', async () => {
    await deleteFromKeyboard('a-2.png');
    expect(document.activeElement).toBe(pickOf('a-3.png'));
  });

  it('goes to the image before when the last one was deleted', async () => {
    await deleteFromKeyboard('a-3.png');
    expect(document.activeElement).toBe(pickOf('a-2.png'));
  });

  it('goes to the search field when nothing is left to show', async () => {
    panel.search = 'deux';
    await Vue.nextTick();
    await Vue.nextTick();
    await deleteFromKeyboard('a-2.png');
    expect(document.activeElement).toBe(
      panel.$el.querySelector('[data-gallery-search]')
    );
  });

  it('stays on the trash button when the delete is cancelled', async () => {
    vm.removeImage.mockImplementation(deleting(false));
    const trash = thumbOf(panel, 'a-2.png').querySelector(
      '[data-gallery-remove]'
    );
    await deleteFromKeyboard('a-2.png');
    expect(document.activeElement).toBe(trash);
  });

  // the user clicked elsewhere meanwhile: the focus is theirs
  it('leaves a focus the user has put elsewhere', async () => {
    const trash = thumbOf(panel, 'a-2.png').querySelector(
      '[data-gallery-remove]'
    );
    let settle;
    vm.removeImage.mockImplementation((file) => {
      vm.mailingGallery.remove((f) => f.name === file.name);
      return new Promise((resolve) => {
        settle = resolve;
      });
    });
    trash.click();
    const search = panel.$el.querySelector('[data-gallery-search]');
    search.focus();
    settle(true);
    await Promise.resolve();
    await Vue.nextTick();
    await Vue.nextTick();
    expect(document.activeElement).toBe(search);
  });
});
