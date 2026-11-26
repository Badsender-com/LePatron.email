/**
 * @jest-environment jsdom
 */
'use strict';

// The precedence of a dimension, in its form: sent only when changed, never
// for the trigger, and an emptied field is refused rather than sent as 0.

const { mountSfc, settle } = require('../../helpers/mount-sfc.js');

const DIALOG =
  'packages/ui/components/group/taxonomy-dimension-form-dialog.vue';

// The modal, reduced to what the form asks of it.
const Modal = {
  name: 'BsModalForm',
  methods: { open() {}, close() {} },
  render(h) {
    return h('div', this.$slots.default);
  },
};

function openForm(dimension) {
  const vm = mountSfc(DIALOG, {
    imports: {
      vuelidate: require('vuelidate'),
      'vuelidate/lib/validators': require('vuelidate/lib/validators'),
      '~/components/modal/bs-modal-form.vue': Modal,
      '~/components/form/bs-text-field.vue': {},
      '~/components/form/bs-textarea.vue': {},
      '~/components/form/bs-select.vue': {},
      '~/helpers/taxonomy.js': require('~/helpers/taxonomy.js'),
      '~/helpers/taxonomy-builder.js': require('~/helpers/taxonomy-builder.js'),
    },
    mocks: { $t: (key) => key },
  });
  const saved = [];
  vm.$on('save', (event) => saved.push(event));
  vm.open(dimension);
  return { vm, saved };
}

const BRAND = {
  id: 'd1',
  name: 'brand',
  label: 'Marque',
  precedence: 10,
};

describe('the precedence of a dimension', () => {
  it('sends a changed precedence as a number', () => {
    const { vm, saved } = openForm(BRAND);
    vm.form.precedence = '30';

    vm.onSubmit();

    expect(saved[0].payload.precedence).toBe(30);
  });

  it('leaves an unchanged precedence out', () => {
    const { vm, saved } = openForm(BRAND);

    vm.onSubmit();

    expect(saved[0].payload).not.toHaveProperty('precedence');
  });

  it('refuses an emptied field rather than sending 0', async () => {
    const { vm, saved } = openForm(BRAND);
    vm.form.precedence = '';

    vm.onSubmit();
    await settle(vm);

    expect(saved).toEqual([]);
    expect(vm.precedenceErrors).toEqual([
      'taxonomy.dimensions.form.precedenceInvalid',
    ]);
  });

  it('refuses a precedence that is not a whole number', () => {
    const { vm, saved } = openForm(BRAND);
    vm.form.precedence = '1.5';

    vm.onSubmit();

    expect(saved).toEqual([]);
  });

  it('never sends one for the trigger, which carries no token', () => {
    const { vm, saved } = openForm({
      id: 'd2',
      name: 'trigger',
      label: 'Déclencheur',
      standard: true,
    });
    vm.form.precedence = '';

    vm.onSubmit();

    expect(saved).toHaveLength(1);
    expect(saved[0].payload).not.toHaveProperty('precedence');
  });
});
