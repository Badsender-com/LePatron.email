/**
 * @jest-environment jsdom
 */
'use strict';

// A release note and a change log at every publication (ADR 0031): the
// activation dialog publishes a minor version too only with both, a release
// note of at most 500 characters, and never offers the generic sentence a
// minor version used to get by default as one.

const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const { wordsOf } = require('../../helpers/ui-words.js');
const audienceChange = require('~/helpers/ai-skill-audience-change.js');
const fr = require('~/helpers/locales/fr.js').default;

const FILE = 'packages/ui/components/ai-skill/bs-ai-activate-modal.vue';
const GENERIC = {
  changelog: 'Correction mineure',
  releaseNotes: 'Correction mineure sans changement de doctrine.',
};

const modalStub = {
  methods: { open() {}, close() {} },
  render(h) {
    return h('div', this.$slots.default);
  },
};

afterEach(() => {
  document.body.innerHTML = '';
});

async function mountModal({ isMajor = false, seed }) {
  const vm = mountSfc(FILE, {
    props: { isMajor },
    mocks: wordsOf(fr),
    imports: {
      'lucide-vue': {},
      '~/components/modal-confirm.vue': modalStub,
      '~/components/form/bs-textarea.vue': {},
      '~/components/ai-skill/bs-ai-open-expertises-choice.vue': {},
      '~/helpers/ai-skill-audience-change.js': audienceChange,
    },
  });
  vm.open(seed);
  await settle(vm);
  const confirm = jest.fn();
  vm.$on('confirm', confirm);
  return { vm, confirm };
}

// Turned on by #1666 (the activation modal requires both texts)
describe.skip('activation modal requires both texts', () => {
  it('publishes no minor version without a release note', async () => {
    const { vm, confirm } = await mountModal({
      seed: { changelog: 'Typo', releaseNotes: '' },
    });

    vm.onSubmit();

    expect(confirm).not.toHaveBeenCalled();
  });

  it('publishes no minor version without a change log', async () => {
    const { vm, confirm } = await mountModal({
      seed: { changelog: '', releaseNotes: 'Subjects get shorter.' },
    });

    vm.onSubmit();

    expect(confirm).not.toHaveBeenCalled();
  });

  it('publishes no release note over 500 characters', async () => {
    const { vm, confirm } = await mountModal({
      seed: { changelog: 'Typo', releaseNotes: 'x'.repeat(501) },
    });

    vm.onSubmit();

    expect(confirm).not.toHaveBeenCalled();
  });

  it('publishes a minor version with both texts', async () => {
    const texts = { changelog: 'Typo', releaseNotes: 'Subjects get shorter.' };
    const { vm, confirm } = await mountModal({ seed: texts });

    vm.onSubmit();

    expect(confirm.mock.calls[0][0]).toMatchObject(texts);
  });

  it('leaves blank the generic sentence of an older draft, for the person to write', async () => {
    const { vm, confirm } = await mountModal({ seed: GENERIC });

    vm.onSubmit();

    expect(confirm).not.toHaveBeenCalled();
    expect(vm.payload).toEqual({ changelog: '', releaseNotes: '' });
  });
});
