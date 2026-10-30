'use strict';

/**
 * Acceptance tests of text generation (epic #1163): the template's preheader.
 *
 * Templates declare their preheader in one of two places
 * (docs/TEMPLATE_DEVELOPER_GUIDE.md, preheader): at the root, or in a root-level
 * preheader block. Where there is none — or the template switches it off — the
 * proposal is offered to copy instead of written.
 */

const ko = require('knockout');

describe('editor: the template preheader', () => {
  let findPreheader;
  let writePreheader;

  beforeAll(() => {
    ({
      findPreheader,
      writePreheader,
    } = require('../../../packages/editor/src/js/ext/text-generation/template-preheader'));
  });

  describe('findPreheader', () => {
    it('finds a preheader declared at the root', () => {
      expect(
        findPreheader({ preheaderText: 'Voir la version en ligne' })
      ).toEqual({
        path: 'preheaderText',
        value: 'Voir la version en ligne',
      });
    });

    it('finds a preheader declared in a preheader block', () => {
      expect(
        findPreheader({ preheaderBlock: { preheaderText: 'Texte d’aperçu' } })
      ).toEqual({
        path: 'preheaderBlock.preheaderText',
        value: 'Texte d’aperçu',
      });
    });

    it('finds an empty preheader, which is still a field to write', () => {
      expect(findPreheader({ preheaderText: '' })).toEqual({
        path: 'preheaderText',
        value: '',
      });
    });

    it('finds nothing when the template declares no preheader', () => {
      expect(findPreheader({ mainBlocks: { blocks: [] } })).toBeNull();
      expect(
        findPreheader({ preheaderBlock: { backgroundColor: '#fff' } })
      ).toBeNull();
    });

    it('finds nothing when the template switches the preheader off: writing it would show nowhere', () => {
      expect(
        findPreheader({ preheaderText: 'Aperçu', preheaderVisible: false })
      ).toBeNull();
    });
  });

  describe('writePreheader', () => {
    it('writes a root preheader into the editor content', () => {
      const preheaderText = ko.observable('Voir la version en ligne');
      const content = ko.observable({ preheaderText });
      expect(
        writePreheader(
          content,
          'Jusqu’à dimanche inclus, sur tout le rayon hiver'
        )
      ).toBe(true);
      expect(preheaderText()).toBe(
        'Jusqu’à dimanche inclus, sur tout le rayon hiver'
      );
    });

    it('writes a preheader declared in a preheader block', () => {
      const preheaderText = ko.observable('');
      const content = ko.observable({
        preheaderBlock: ko.observable({ preheaderText }),
      });
      expect(
        writePreheader(
          content,
          'Mardi 15 mars à 11h, en ligne et sur inscription'
        )
      ).toBe(true);
      expect(preheaderText()).toBe(
        'Mardi 15 mars à 11h, en ligne et sur inscription'
      );
    });

    it('writes nothing and says so when the template has no preheader', () => {
      const content = ko.observable({
        mainBlocks: ko.observable({ blocks: ko.observableArray([]) }),
      });
      expect(writePreheader(content, 'Texte')).toBe(false);
      expect(Object.keys(content())).toEqual(['mainBlocks']);
    });
  });
});
