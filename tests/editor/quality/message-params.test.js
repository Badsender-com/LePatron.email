/**
 * @jest-environment jsdom
 */

'use strict';

// What a finding quotes reads in the language of the page: the rules give raw
// numbers, the drawer writes them for its reader.

const {
  formatParams,
  kbSize,
  pageLocale,
} = require('../../../packages/editor/src/js/ext/quality/message-params.js');
const en = require('../../../public/lang/badsender-en.js');
const fr = require('../../../public/lang/badsender-fr.js');
const {
  findingItems,
  checkItems,
} = require('../../../packages/editor/src/js/vue/components/quality-drawer/quality-items.js');
const { fakeViewModel } = require('./fake-view-model');

// Intl separates thousands with a narrow no-break space in French.
const spaced = (text) => text.replace(/[\u202f\u00a0]/g, ' ');

describe('formatParams', () => {
  it('writes decimals in the language of the reader', () => {
    expect(formatParams({ ratio: 1.4 }, { locale: 'fr' })).toEqual({
      ratio: '1,4',
    });
    expect(formatParams({ ratio: 1.4 }, { locale: 'en' })).toEqual({
      ratio: '1.4',
    });
  });

  it('groups thousands, and rounds to two decimals', () => {
    expect(spaced(formatParams({ n: 1234 }, { locale: 'fr' }).n)).toBe('1 234');
    expect(formatParams({ n: 0.8333 }, { locale: 'en' }).n).toBe('0.83');
  });

  it('leaves text as it is: a link label is quoted as written', () => {
    expect(
      formatParams({ label: '1.5 offer', size: '512+' }, { locale: 'fr' })
    ).toEqual({ label: '1.5 offer', size: '512+' });
  });

  describe('a weight in KB', () => {
    // The editor's translation: the strings of the language, then the params.
    const translator = (strings) => (key, params) =>
      Object.keys(params).reduce(
        (text, name) => text.replace(`__${name}__`, params[name]),
        strings[key]
      );
    const weight = (kb, locale, strings) =>
      formatParams({ max: kbSize(kb) }, { locale, t: translator(strings) }).max;

    it('reads in MB when it is a whole number of them', () => {
      expect(weight(1024, 'en', en)).toBe('1 MB');
      expect(weight(2048, 'en', en)).toBe('2 MB');
      expect(weight(1024, 'fr', fr)).toBe('1 Mo');
      expect(weight(10240, 'fr', fr)).toBe('10 Mo');
    });

    it('reads in KB otherwise', () => {
      expect(weight(500, 'en', en)).toBe('500 KB');
      expect(weight(1500, 'en', en)).toBe('1,500 KB');
      expect(spaced(weight(1500, 'fr', fr))).toBe('1 500 Ko');
    });
  });

  it('builds one number formatter per language, not one per row', () => {
    const spy = jest.spyOn(Intl, 'NumberFormat');
    formatParams({ n: 1 }, { locale: 'de' });
    formatParams({ n: 2 }, { locale: 'de' });
    expect(formatParams({ n: 1.5 }, { locale: 'de' })).toEqual({ n: '1,5' });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('takes the language of the page by default', () => {
    document.documentElement.lang = 'fr';
    expect(pageLocale()).toBe('fr');
    expect(formatParams({ ratio: 0.9 })).toEqual({ ratio: '0,9' });
    document.documentElement.lang = '';
    expect(pageLocale()).toBeUndefined();
  });
});

describe('the rows of the drawer', () => {
  const { t } = fakeViewModel();

  it('quote the numbers of a finding in the language of the page', () => {
    const [row] = findingItems(
      [
        {
          ruleId: 'text-layout',
          category: 'accessibility',
          titleKey: 'Text layout',
          severity: 'warning',
          messageKey: 'Line height of __ratio__, under __min__',
          params: { ratio: 1.25, min: 1.5 },
          fingerprint: 'text-layout|b1|longText|x',
        },
      ],
      t,
      'fr'
    );
    expect(row.description).toBe('Line height of 1,25, under 1,5');
  });

  it('quote the numbers of a passed check in the language of the page', () => {
    const [row] = checkItems(
      [
        {
          ruleId: 'html-size',
          category: 'technical',
          titleKey: 'Email weight',
          status: 'passed',
          passKey: 'Weighs __size__ KB',
          passParams: { size: 1500 },
        },
      ],
      t,
      'en'
    );
    expect(row.description).toBe('Weighs 1,500 KB');
  });
});
