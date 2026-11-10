/**
 * @jest-environment jsdom
 */
'use strict';

// BsFormSection's card variant: a card of its own, its icon on a tile tinted
// while its feature is on and grey when off. Without `card`, a section is as
// the other settings screens have it, whatever `active` says.

const Vue = require('vue');
const { componentOf } = require('../../helpers/mount-sfc.js');

const BsFormSection = componentOf(
  'packages/ui/components/layout/bs-form-section.vue'
);

function mountSection(props) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return new Vue({
    render: (h) =>
      h(BsFormSection, { props }, [
        h('i', { slot: 'icon' }),
        h('span', { slot: 'title' }, 'Title'),
        h('p', { class: 'content' }, 'Content'),
      ]),
  }).$mount(host).$el;
}

describe('a form section', () => {
  it('is a card, its tile tinted, while its feature is on', () => {
    const section = mountSection({ card: true, active: true });

    expect(section.classList).toContain('bs-form-section--card');
    expect(section.classList).not.toContain('bs-form-section--idle');
    expect(section.querySelector('.bs-form-section__icon i')).not.toBeNull();
    expect(
      section.querySelector('.bs-form-section__content .content')
    ).not.toBeNull();
  });

  it('is a card, its tile grey, while its feature is off', () => {
    const section = mountSection({ card: true, active: false });

    expect(section.classList).toContain('bs-form-section--card');
    expect(section.classList).toContain('bs-form-section--idle');
  });

  it('is no card without `card`, on or off', () => {
    [true, false].forEach((active) => {
      const section = mountSection({ active });

      expect(section.classList).not.toContain('bs-form-section--card');
      expect(section.classList).not.toContain('bs-form-section--idle');
    });
  });
});
