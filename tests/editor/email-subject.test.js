'use strict';

/**
 * The subject's one accessor (ext/email-subject.js, ADR 0004), shared by
 * quality control and the AI actions. The email metadata store is its source
 * of truth: what is written is read back at once, and the metadata section
 * shows it.
 */

const {
  createEmailMetadataStore,
} = require('../../packages/editor/src/js/utils/email-metadata-store');
const {
  getSubject,
  canWriteSubject,
  setSubject,
} = require('../../packages/editor/src/js/ext/email-subject');

const FORM = {
  subject: 'Nos nouveautés',
  plannedSendDate: '',
  emailTypeId: '',
  trigger: '',
};

function viewModel({ mounted = true } = {}) {
  const store = createEmailMetadataStore();
  if (mounted) store.reset(FORM);
  return { emailMetadataStore: store };
}

describe('the subject of the email', () => {
  it('reads null when the company leaves the subject to its sending platform', () => {
    const vm = viewModel({ mounted: false });
    expect(getSubject(vm)).toBeNull();
    expect(canWriteSubject(vm)).toBe(false);
  });

  it('writes nothing when there is no subject field', () => {
    const vm = viewModel({ mounted: false });
    expect(setSubject(vm, 'Un objet')).toBe(false);
    expect(getSubject(vm)).toBeNull();
  });

  it('reads back at once what was written', () => {
    const vm = viewModel();
    expect(setSubject(vm, 'Lin : -30 % jusqu’à dimanche')).toBe(true);
    expect(getSubject(vm)).toBe('Lin : -30 % jusqu’à dimanche');
  });

  it('makes the email dirty, so the editor saves it', () => {
    const vm = viewModel();
    setSubject(vm, 'Un autre objet');
    expect(vm.emailMetadataStore.isDirty()).toBe(true);
    expect(vm.emailMetadataStore.payload()).toEqual({
      subject: 'Un autre objet',
    });
  });

  it('tells the metadata section, which shows the new subject', () => {
    const vm = viewModel();
    const shown = jest.fn();
    vm.emailMetadataStore.onWrite(shown);
    setSubject(vm, 'Un autre objet');
    expect(shown).toHaveBeenCalledWith('subject', 'Un autre objet');
  });
});
