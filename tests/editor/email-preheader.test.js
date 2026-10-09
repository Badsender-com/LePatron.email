'use strict';

/**
 * The preheader's one accessor (ext/email-preheader.js, ADR 0004), shared by
 * quality control and the AI actions.
 *
 * Templates declare their preheader in one of two places
 * (docs/TEMPLATE_DEVELOPER_GUIDE.md, preheader): at the root, or in a root-level
 * preheader block. Where there is none, or the template switches it off, a
 * generated preheader is offered to copy instead of written.
 */

const ko = require('knockout');
const {
  readPreheader,
  canWritePreheader,
  writePreheader,
} = require('../../packages/editor/src/js/ext/email-preheader');

const viewModel = (content, templateDefaults = {}) => ({
  content: ko.observable(content),
  templateDefaults,
});

describe('the preheader of the email', () => {
  describe('reading it', () => {
    it('finds a preheader declared at the root, with the template default', () => {
      const vm = viewModel(
        { preheaderText: ko.observable('Voir la version en ligne') },
        { preheaderText: 'Texte d’aperçu du modèle' }
      );
      expect(readPreheader(vm)).toEqual({
        path: 'preheaderText',
        value: 'Voir la version en ligne',
        templateDefault: 'Texte d’aperçu du modèle',
        turnedOff: false,
      });
    });

    it('finds a preheader declared in a preheader block', () => {
      const vm = viewModel({
        preheaderBlock: ko.observable({
          preheaderText: ko.observable('Texte d’aperçu'),
        }),
      });
      expect(readPreheader(vm)).toEqual({
        path: 'preheaderBlock.preheaderText',
        value: 'Texte d’aperçu',
        templateDefault: '',
        turnedOff: false,
      });
    });

    it('finds an empty preheader, which is still a field to write', () => {
      const vm = viewModel({ preheaderText: ko.observable('') });
      expect(readPreheader(vm).value).toBe('');
      expect(canWritePreheader(vm)).toBe(true);
    });

    it('finds nothing when the template declares no preheader', () => {
      expect(
        readPreheader(viewModel({ mainBlocks: { blocks: [] } }))
      ).toBeNull();
      expect(
        readPreheader(
          viewModel({ preheaderBlock: { backgroundColor: '#fff' } })
        )
      ).toBeNull();
    });

    it('says when the template switches the preheader off: it can be read, not written', () => {
      const vm = viewModel({
        preheaderText: ko.observable('Aperçu'),
        preheaderVisible: false,
      });
      expect(readPreheader(vm).turnedOff).toBe(true);
      expect(canWritePreheader(vm)).toBe(false);
    });
  });

  describe('writing it', () => {
    it('writes a root preheader into the editor content', () => {
      const preheaderText = ko.observable('Voir la version en ligne');
      const vm = viewModel({ preheaderText });
      expect(
        writePreheader(vm, 'Jusqu’à dimanche inclus, sur tout le rayon hiver')
      ).toBe(true);
      expect(preheaderText()).toBe(
        'Jusqu’à dimanche inclus, sur tout le rayon hiver'
      );
    });

    it('writes a preheader declared in a preheader block', () => {
      const preheaderText = ko.observable('');
      const vm = viewModel({
        preheaderBlock: ko.observable({ preheaderText }),
      });
      expect(
        writePreheader(vm, 'Mardi 15 mars à 11h, en ligne et sur inscription')
      ).toBe(true);
      expect(preheaderText()).toBe(
        'Mardi 15 mars à 11h, en ligne et sur inscription'
      );
    });

    it('writes nothing and says so when the template has no preheader', () => {
      const vm = viewModel({
        mainBlocks: ko.observable({ blocks: ko.observableArray([]) }),
      });
      expect(writePreheader(vm, 'Texte')).toBe(false);
      expect(Object.keys(vm.content())).toEqual(['mainBlocks']);
    });

    it('writes nothing when the template switches the preheader off', () => {
      const preheaderText = ko.observable('Aperçu');
      const vm = viewModel({ preheaderText, preheaderVisible: false });
      expect(writePreheader(vm, 'Texte')).toBe(false);
      expect(preheaderText()).toBe('Aperçu');
    });
  });
});
