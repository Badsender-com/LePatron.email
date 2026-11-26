/**
 * @jest-environment jsdom
 */
'use strict';

// The design tokens of a value, edited as rows: what the server would refuse
// is said row by row, and nothing is sent while a row is wrong.

const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const builder = require('~/helpers/taxonomy-builder.js');

const FIELD = 'packages/ui/components/group/taxonomy-tokens-field.vue';

function mountField(value = {}, props = {}) {
  const vm = mountSfc(FIELD, {
    props: { value, ...props },
    imports: {
      'lucide-vue': { Plus: {}, X: {} },
      '~/components/form/bs-text-field.vue': {},
      '~/helpers/taxonomy-builder.js': builder,
    },
    mocks: { $t: (key, params) => `${key} ${JSON.stringify(params || {})}` },
  });
  const sent = [];
  vm.$on('input', (tokens) => sent.push(tokens));
  return { vm, sent };
}

describe('the token rows of a value', () => {
  it('opens on the tokens of the value', () => {
    const { vm } = mountField({ mainColorVar: '#ffd845' });

    expect(vm.rows.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'mainColorVar', value: '#ffd845' },
    ]);
    expect(vm.validate()).toBe(true);
  });

  it('says nothing of a row being written until it is left', () => {
    const { vm } = mountField();
    vm.add();
    vm.rows[0].name = 'mainColorVar';

    expect(vm.valueErrors(0)).toEqual([]);

    vm.touch(0);

    expect(vm.valueErrors(0)).toEqual([
      'taxonomy.values.form.tokenValueRequired {"max":200}',
    ]);
  });

  it('refuses the save while a row is wrong, and shows every error', () => {
    const { vm } = mountField();
    vm.add();
    vm.add();
    vm.rows[0].name = 'mainColorVar';
    vm.rows[0].value = '#ffd845';
    vm.rows[1].name = 'mainColorVar';
    vm.rows[1].value = 'red; x: y';

    expect(vm.validate()).toBe(false);
    expect(vm.nameErrors(0)).toEqual([
      'taxonomy.values.form.tokenNameDuplicate {"max":60}',
    ]);
    expect(vm.valueErrors(1)).toEqual([
      'taxonomy.values.form.tokenValueUnsafe {"max":200}',
    ]);
  });

  it('lets a row left entirely empty through: it is dropped', () => {
    const { vm } = mountField({ mainColorVar: '#ffd845' });
    vm.add();

    expect(vm.validate()).toBe(true);
  });

  it('bounds the name and the value at the server limits', async () => {
    const { vm } = mountField();
    vm.add();
    await settle(vm);

    const [name, value] = vm.$el.querySelectorAll('bs-text-field');
    expect(name.getAttribute('maxlength')).toBe('60');
    expect(value.getAttribute('maxlength')).toBe('200');
    expect(value.getAttribute('counter')).toBe('200');
  });

  it('sends the tokens without the rows left nameless', () => {
    const { vm, sent } = mountField({ mainColorVar: '#ffd845' });
    vm.add();
    vm.emit();

    expect(sent).toEqual([{ mainColorVar: '#ffd845' }]);
  });

  it('shows the refusal the server alone decides', async () => {
    const { vm } = mountField({ brand: '#000' }, { serverError: 'taken' });
    await settle(vm);

    expect(vm.$el.querySelector('[role="alert"]').textContent).toContain(
      'taken'
    );
  });
});
