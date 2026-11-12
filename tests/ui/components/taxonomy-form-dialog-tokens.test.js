/**
 * @jest-environment jsdom
 */
'use strict';

// The design tokens in the value form: a wrong row keeps the form from
// saving, and each opening shows the rows of the value opened, never those
// left from the previous one.

const { mountSfc, componentOf, settle } = require('../../helpers/mount-sfc.js');
const builder = require('~/helpers/taxonomy-builder.js');
const Vue = require('vue');

// The tokens field is rendered as a child, which the mocks of the dialog do
// not reach: it reads its translations from Vue, as with the i18n plugin.
Vue.prototype.$t = (key) => key;

const DIALOG = 'packages/ui/components/group/taxonomy-form-dialog.vue';
const TOKENS_FIELD = 'packages/ui/components/group/taxonomy-tokens-field.vue';

// The modal, reduced to what the form asks of it.
const Modal = {
  name: 'BsModalForm',
  methods: { open() {}, close() {} },
  render(h) {
    return h('div', this.$slots.default);
  },
};

const TokensField = componentOf(TOKENS_FIELD, {
  'lucide-vue': { Plus: {}, X: {} },
  '~/components/form/bs-text-field.vue': {},
  '~/helpers/taxonomy-builder.js': builder,
});

function mountDialog() {
  const vm = mountSfc(DIALOG, {
    props: { isEmailType: false },
    imports: {
      vuelidate: require('vuelidate'),
      'vuelidate/lib/validators': require('vuelidate/lib/validators'),
      '~/components/modal/bs-modal-form.vue': Modal,
      '~/components/form/bs-text-field.vue': {},
      '~/components/form/bs-select.vue': {},
      '~/components/form/bs-textarea.vue': {},
      '~/components/group/taxonomy-form-order-status.vue': {},
      '~/components/group/taxonomy-availability-field.vue': {},
      '~/components/group/taxonomy-tokens-field.vue': TokensField,
      '~/components/group/taxonomy-code-field.vue': {},
      '~/helpers/taxonomy.js': require('~/helpers/taxonomy.js'),
      '~/helpers/taxonomy-builder.js': builder,
    },
  });
  const saved = [];
  vm.$on('save', (event) => saved.push(event));
  return { vm, saved };
}

const BRAND_A = {
  id: 'v1',
  label: 'Marque A',
  tokens: { mainColorVar: '#ffd845' },
};
const BRAND_B = {
  id: 'v2',
  label: 'Marque B',
  tokens: { textColorVar: '#1a1a1a' },
};

const rowNames = (vm) => vm.$refs.tokensField.rows.map((row) => row.name);

describe('the design tokens of the value form', () => {
  it('saves the tokens of a value whose rows are right', async () => {
    const { vm, saved } = mountDialog();
    vm.open(BRAND_A);
    await settle(vm);

    vm.onSubmit();

    expect(saved).toHaveLength(1);
    expect(saved[0].payload.tokens).toEqual({ mainColorVar: '#ffd845' });
  });

  it('emits no save while a token row is wrong', async () => {
    const { vm, saved } = mountDialog();
    vm.open(BRAND_A);
    await settle(vm);
    const field = vm.$refs.tokensField;
    field.add();
    field.rows[1].name = 'textColorVar';

    vm.onSubmit();
    await settle(vm);

    expect(saved).toEqual([]);
    expect(field.valueErrors(1)).toEqual([
      'taxonomy.values.form.tokenValueRequired',
    ]);
  });

  it('shows the rows of the value opened next, not those left over', async () => {
    const { vm } = mountDialog();
    vm.open(BRAND_A);
    await settle(vm);
    vm.$refs.tokensField.add();
    expect(rowNames(vm)).toEqual(['mainColorVar', '']);

    vm.open(BRAND_B);
    await settle(vm);

    expect(rowNames(vm)).toEqual(['textColorVar']);
  });

  it('opens a new value with no row', async () => {
    const { vm } = mountDialog();
    vm.open(BRAND_A);
    await settle(vm);

    vm.open(null);
    await settle(vm);

    expect(rowNames(vm)).toEqual([]);
  });
});
