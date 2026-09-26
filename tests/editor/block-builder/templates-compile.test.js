/**
 * @jest-environment jsdom
 */

'use strict';

// Every Vue template of the builder must compile.
//
// This exists because one did not, and nothing caught it: an apostrophe inside
// a Vue expression cannot be escaped when the template is itself a JS template
// literal — `\'` becomes `'` before Vue ever sees it, and the expression fails
// to compile. Vue reports that as a console error and renders nothing, so the
// settings panel went blank, TinyMCE never appeared and the gallery never
// opened. Every unit test still passed, because none of them rendered the
// panel with an image element selected.
//
// Mounting each component with real data is what turns that into a failure
// here rather than a bug report.

const Vue = require('vue/dist/vue.common');

const {
  BlockBuilderModalComponent,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/block-builder-modal.js');
const {
  ElementSettingsComponent,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/element-settings.js');
const {
  RichTextFieldComponent,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/rich-text-field.js');
const {
  ELEMENTS,
} = require('../../../packages/shared/block-builder/elements/index.js');
const {
  FIELDS,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/element-settings.js');

let errors;

beforeEach(() => {
  errors = [];
  // Vue reports a template that fails to compile through console.error, and
  // carries on. Collecting them is the only way to see it.
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    errors.push(args.join(' '));
  });
  jest.spyOn(console, 'warn').mockImplementation((...args) => {
    errors.push(args.join(' '));
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  document.body.innerHTML = '';
});

function mount(component, data, template) {
  const host = document.createElement('div');
  document.body.appendChild(host);

  return new Vue({
    el: host,
    components: { Subject: component },
    data,
    template,
  });
}

const LABELS = { empty: 'empty', choose: 'choose', change: 'change' };

describe('the settings panel compiles and renders', () => {
  // Counting the rendered fields rather than only watching the console: Vue
  // compiles a component's template once and caches the render function on its
  // options, so a compile error is reported on the first mount of the file and
  // never again. Watching `errors` alone would therefore only cover whichever
  // case happens to run first.
  test.each(ELEMENTS.map((element) => [element.type, element]))(
    'every field of a %s element',
    (type, element) => {
      const app = mount(
        ElementSettingsComponent,
        {
          element: { id: 'a', type, ...element.defaults },
          labels: LABELS,
        },
        '<subject :element="element" :labels="labels" />'
      );

      expect(errors).toEqual([]);
      expect(app.$el.querySelectorAll('.bb-settings__field')).toHaveLength(
        FIELDS[type].length
      );
    }
  );

  it('with nothing selected', () => {
    mount(
      ElementSettingsComponent,
      { element: null, labels: LABELS },
      '<subject :element="element" :labels="labels" />'
    );

    expect(errors).toEqual([]);
  });

  // The image field is the one that regressed, so it gets its own assertion on
  // what it actually shows.
  it('offers a picker on an image, labelled by what is already there', () => {
    const app = mount(
      ElementSettingsComponent,
      {
        element: { id: 'a', type: 'image', src: 'https://e.com/a.png' },
        labels: LABELS,
      },
      '<subject :element="element" :labels="labels" />'
    );

    expect(app.$el.querySelector('.bb-settings__pick').textContent.trim()).toBe(
      'change'
    );
    expect(app.$el.querySelector('.bb-settings__thumb')).not.toBeNull();
  });

  it('labels the picker differently when there is no image yet', () => {
    const app = mount(
      ElementSettingsComponent,
      { element: { id: 'a', type: 'image', src: '' }, labels: LABELS },
      '<subject :element="element" :labels="labels" />'
    );

    expect(app.$el.querySelector('.bb-settings__pick').textContent.trim()).toBe(
      'choose'
    );
    expect(app.$el.querySelector('.bb-settings__thumb')).toBeNull();
  });
});

describe('the other templates compile', () => {
  it('the rich text field', () => {
    mount(
      RichTextFieldComponent,
      { value: 'Bonjour' },
      '<subject :value="value" />'
    );

    expect(errors).toEqual([]);
  });

  it('the modal, with an element added', () => {
    const vm = {
      t: (key) => key,
      startMultiple: () => {},
      stopMultiple: () => {},
    };
    const app = mount(
      BlockBuilderModalComponent,
      { vm },
      '<subject :vm="vm" />'
    );

    app.$children[0].handleToggle(true, { accessor: () => '' });
    app.$children[0].addElement('image');

    expect(errors).toEqual([]);
  });
});
