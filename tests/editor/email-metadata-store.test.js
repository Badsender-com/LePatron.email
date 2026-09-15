'use strict';

const store = require('../../packages/editor/src/js/utils/email-metadata-store');

const FORM = {
  subject: 'Nos nouveautés',
  plannedSendDate: '2026-09-01',
  emailTypeId: 'abc123',
};

describe('email metadata store', () => {
  afterEach(() => {
    store.dispose();
  });

  describe('before the section is mounted', () => {
    // An opted-out company never mounts the section. The save command asks the
    // store on every save, so "no section" has to be a safe, quiet answer rather
    // than a crash or a spurious dirty flag.
    it('is inactive and never dirty', () => {
      expect(store.isActive()).toBe(false);
      expect(store.isDirty()).toBe(false);
    });

    it('ignores edits', () => {
      store.setCurrent(FORM);
      expect(store.isDirty()).toBe(false);
    });

    it('ignores markSaved', () => {
      expect(() => store.markSaved()).not.toThrow();
      expect(store.isActive()).toBe(false);
    });
  });

  describe('once armed', () => {
    beforeEach(() => {
      store.reset(FORM);
    });

    it('opens clean', () => {
      expect(store.isActive()).toBe(true);
      expect(store.isDirty()).toBe(false);
    });

    it('goes dirty on a changed field', () => {
      store.setCurrent({ ...FORM, subject: 'Autre objet' });
      expect(store.isDirty()).toBe(true);
    });

    it('stays clean when a field is set to the value it already had', () => {
      store.setCurrent({ ...FORM });
      expect(store.isDirty()).toBe(false);
    });

    // Typing something and undoing it by hand should leave the button quiet.
    it('goes back to clean when the edit is reverted', () => {
      store.setCurrent({ ...FORM, subject: 'Autre objet' });
      store.setCurrent({ ...FORM });
      expect(store.isDirty()).toBe(false);
    });

    it('detects a cleared field', () => {
      store.setCurrent({ ...FORM, emailTypeId: '' });
      expect(store.isDirty()).toBe(true);
    });

    it('builds the PATCH body from the current state, not the initial one', () => {
      store.setCurrent({ ...FORM, subject: '  Objet espacé  ' });
      expect(store.payload()).toEqual({
        subject: 'Objet espacé',
        plannedSendDate: '2026-09-01T12:00:00.000Z',
        emailTypeId: 'abc123',
      });
    });

    it('sends null for an emptied subject and typology', () => {
      store.setCurrent({
        subject: '   ',
        plannedSendDate: '',
        emailTypeId: '',
      });
      expect(store.payload()).toEqual({
        subject: null,
        plannedSendDate: null,
        emailTypeId: null,
      });
    });

    it('is clean again after markSaved', () => {
      store.setCurrent({ ...FORM, subject: 'Autre objet' });
      store.markSaved();
      expect(store.isDirty()).toBe(false);
    });

    // The reason markSaved is called only on a successful PATCH: a failed save
    // must keep the button signalling that something still needs saving.
    it('stays dirty when markSaved is not called', () => {
      store.setCurrent({ ...FORM, subject: 'Autre objet' });
      expect(store.isDirty()).toBe(true);
    });

    it('measures later edits against the state markSaved recorded', () => {
      store.setCurrent({ ...FORM, subject: 'Autre objet' });
      store.markSaved();
      store.setCurrent({ ...FORM });
      expect(store.isDirty()).toBe(true);
    });

    it('does not keep a reference to the caller object', () => {
      const mutable = { ...FORM };
      store.setCurrent(mutable);
      mutable.subject = 'Modifié après coup';
      expect(store.isDirty()).toBe(false);
    });
  });

  describe('a save that overlaps with typing', () => {
    beforeEach(() => {
      store.reset(FORM);
    });

    // The loss this pins: markSaved used to reset to whatever `current` held when
    // the response came back. An edit made during the request was then recorded as
    // saved, the button went quiet, and the correction was never sent.
    it('keeps the edit made while the request was in flight', () => {
      store.setCurrent({ ...FORM, subject: 'Premier objet' });
      const sent = store.snapshot();

      // The user keeps typing before the response lands.
      store.setCurrent({ ...FORM, subject: 'Objet corrigé' });
      store.markSaved(sent);

      expect(store.isDirty()).toBe(true);
      expect(store.payload().subject).toBe('Objet corrigé');
    });

    it('goes clean when nothing changed during the request', () => {
      store.setCurrent({ ...FORM, subject: 'Premier objet' });
      const sent = store.snapshot();
      store.markSaved(sent);
      expect(store.isDirty()).toBe(false);
    });

    it('snapshot does not alias the live state', () => {
      store.setCurrent({ ...FORM, subject: 'Premier objet' });
      const sent = store.snapshot();
      store.setCurrent({ ...FORM, subject: 'Objet corrigé' });
      expect(sent.subject).toBe('Premier objet');
    });
  });
});
