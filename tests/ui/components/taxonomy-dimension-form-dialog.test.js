'use strict';

// The parent a dimension hangs under, in its edit form: the active dimensions it
// may hang under, and the one it hangs under even once deactivated.

const { loadVueComponent } = require('../load-vue-component.js');

const component = loadVueComponent(
  'components/group/taxonomy-dimension-form-dialog.vue',
  { vuelidate: { validationMixin: {} } }
);
const { parentItems } = component.computed;

const dimension = (name, label, extra = {}) => ({
  name,
  label,
  isActive: true,
  order: 0,
  ...extra,
});

const itemsFor = ({ dimensions, name, initialParentName = null }) =>
  parentItems.call({
    dimensions,
    form: { name },
    initialParentName,
    $t: (key, params) =>
      params ? `${key}:${JSON.stringify(params)}` : `${key}`,
  });

describe('dimension form: the parent select', () => {
  it('keeps the deactivated parent it hangs under, marked deactivated', () => {
    const items = itemsFor({
      dimensions: [
        dimension('market', 'Marché', { isActive: false }),
        dimension('language', 'Langue', { parentName: 'market' }),
        dimension('brand', 'Marque'),
      ],
      name: 'language',
      initialParentName: 'market',
    });

    expect(items).toContainEqual({
      value: 'market',
      text: 'taxonomy.dimensions.form.parentDeactivated:{"label":"Marché"}',
    });
    expect(items).toContainEqual({ value: 'brand', text: 'Marque' });
  });

  it('offers no other deactivated dimension', () => {
    const items = itemsFor({
      dimensions: [
        dimension('market', 'Marché', { isActive: false }),
        dimension('language', 'Langue'),
      ],
      name: 'language',
    });

    expect(items.map((item) => item.value)).toEqual([null]);
  });
});
