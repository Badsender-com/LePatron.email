/**
 * @jest-environment jsdom
 */
'use strict';

// BsSelect hands its `selection` slot to Vuetify's select: a caller says how
// the chosen items read (the AI features' languages read as one line).
// Without it, the select keeps Vuetify's own.

const Vue = require('vue');
const { componentOf } = require('../../helpers/mount-sfc.js');
const mixinInputId = require('../../../packages/ui/helpers/mixins/mixin-input-id.js');

// Vuetify's select as far as the slot goes: each chosen item through the
// `selection` slot when it is given, its text otherwise.
Vue.component('VSelect', {
  props: {
    value: { type: [String, Array], default: null },
    items: { type: Array, default: () => [] },
  },
  render(h) {
    const chosen = [].concat(this.value || []);
    const slot = this.$scopedSlots.selection;
    return h(
      'div',
      { class: 'v-select' },
      chosen.map((value, index) => {
        const item = this.items.find((one) => one.value === value);
        return slot
          ? h('span', { class: 'selection' }, slot({ item, index }))
          : h('span', { class: 'default' }, item.text);
      })
    );
  },
});

const BsSelect = componentOf('packages/ui/components/form/bs-select.vue', {
  '~/helpers/mixins/mixin-input-id.js': mixinInputId,
});

const ITEMS = [
  { value: 'fr', text: 'French' },
  { value: 'en', text: 'English' },
];

function mountSelect(scopedSlots) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return new Vue({
    render: (h) =>
      h(BsSelect, {
        props: { value: ['fr', 'en'], items: ITEMS, multiple: true },
        scopedSlots,
      }),
  }).$mount(host).$el;
}

describe('the selection of a BsSelect', () => {
  it("reads as the caller's slot says, with the item and its index", () => {
    const el = mountSelect({
      selection: ({ item, index }) => `${index}:${item.text}`,
    });

    expect(
      [...el.querySelectorAll('.selection')].map((span) => span.textContent)
    ).toEqual(['0:French', '1:English']);
    expect(el.querySelector('.default')).toBeNull();
  });

  it("is Vuetify's own without the slot", () => {
    const el = mountSelect({});

    expect(
      [...el.querySelectorAll('.default')].map((span) => span.textContent)
    ).toEqual(['French', 'English']);
    expect(el.querySelector('.selection')).toBeNull();
  });
});
