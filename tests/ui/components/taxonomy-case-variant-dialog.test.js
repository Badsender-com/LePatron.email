/**
 * @jest-environment jsdom
 */
'use strict';

// Declaring `Market` beside `market`: the server holds the declaration back,
// the dialog explains why and, if the admin confirms, hands the declaration
// back with the confirmation for the screen to send again.

const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const taxonomy = require('~/helpers/taxonomy.js');

const DIALOG = 'packages/ui/components/group/taxonomy-case-variant-dialog.vue';

// The confirmation modal, reduced to what the dialog asks of it.
const ModalConfirm = {
  name: 'BsModalConfirm',
  data: () => ({ opened: false }),
  methods: {
    open() {
      this.opened = true;
    },
  },
  render(h) {
    return h('div', this.$slots.default);
  },
};

const refusal = (message, details) => ({
  response: { data: { message, details } },
});
const CASE_VARIANT = refusal('DIMENSION_NAME_DIFFERS_ONLY_BY_CASE', {
  existingName: 'market',
});
const PAYLOAD = { name: 'Market', label: 'Marché bis', description: null };

function mountDialog() {
  const vm = mountSfc(DIALOG, {
    imports: {
      '~/components/modal-confirm': ModalConfirm,
      '~/helpers/taxonomy.js': taxonomy,
    },
    mocks: { $t: (key, params) => `${key} ${JSON.stringify(params || {})}` },
  });
  const confirmed = [];
  vm.$on('confirm', (payload) => confirmed.push(payload));
  return { vm, confirmed, modal: vm.$refs.modal };
}

describe('the case variant dialog', () => {
  it('leaves any other refusal to the screen, and asks nothing', () => {
    const { vm, modal } = mountDialog();

    expect(vm.ask(refusal('DIMENSION_NAME_ALREADY_EXISTS'), PAYLOAD)).toBe(
      false
    );
    expect(modal.opened).toBe(false);
  });

  it('asks about this refusal, naming both dimensions', async () => {
    const { vm, modal } = mountDialog();

    expect(vm.ask(CASE_VARIANT, PAYLOAD)).toBe(true);
    await settle(vm);

    expect(modal.opened).toBe(true);
    expect(vm.$el.textContent).toContain(
      'taxonomy.dimensions.caseVariant.message {"name":"Market","existingName":"market"}'
    );
    expect(vm.$el.textContent).toContain(
      'taxonomy.dimensions.caseVariant.consequence'
    );
  });

  it('hands the declaration back, confirmed, when the admin goes on', () => {
    const { vm, modal, confirmed } = mountDialog();
    vm.ask(CASE_VARIANT, PAYLOAD);

    modal.$emit('confirm');

    expect(confirmed).toEqual([{ ...PAYLOAD, confirmCaseVariant: true }]);
  });

  it('forgets the declaration when the admin cancels', async () => {
    const { vm, modal, confirmed } = mountDialog();
    vm.ask(CASE_VARIANT, PAYLOAD);

    modal.$emit('cancel');
    await settle(vm);

    expect(confirmed).toEqual([]);
    expect(vm.$el.textContent).not.toContain('caseVariant.message');
  });
});
