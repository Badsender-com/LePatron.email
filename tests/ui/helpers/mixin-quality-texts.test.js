import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';
import { CHECKS, SERVER_CHECKS } from '~/helpers/constants/quality-checks.js';
import en from '~/helpers/locales/en.js';
import fr from '~/helpers/locales/fr.js';

/**
 * How the "Contrôle qualité" pages word a check: the language's punctuation
 * and numbers, and what the catalogue says rather than a sentence written
 * once.
 *
 * The project has no @vue/test-utils: the mixin's methods run on a stand-in
 * for the component, whose $t reads the real locale files.
 */
const LOCALES = { en, fr };

const lookup = (messages, key) =>
  key
    .split('.')
    .reduce((node, part) => (node ? node[part] : undefined), messages);

function textsIn(locale) {
  const messages = LOCALES[locale];
  const vm = {
    $i18n: { locale },
    $te: (key) => typeof lookup(messages, key) === 'string',
    $t: (key, params = {}) => {
      const message = lookup(messages, key);
      if (typeof message !== 'string') throw new Error(`No ${key}`);
      return message.replace(/\{(\w+)\}/g, (_, name) => String(params[name]));
    },
  };
  Object.entries(mixinQualityTexts.methods).forEach(([name, method]) => {
    vm[name] = method.bind(vm);
  });
  return vm;
}

describe('the quality settings texts', () => {
  it('puts the language punctuation between a check and its value', () => {
    expect(
      textsIn('fr').exceptionSummary('subject', {
        state: 'blocking',
        thresholds: {},
      })
    ).toBe('Objet : Bloquant');
    expect(
      textsIn('en').exceptionSummary('subject', {
        state: 'blocking',
        thresholds: {},
      })
    ).toBe('Subject: Blocking');
  });

  it('writes the numbers the language way', () => {
    const texts = textsIn('fr');
    expect(texts.formatNumber(0.5)).toBe('0,5');
    expect(
      texts.exceptionSummary('text-layout', {
        state: null,
        thresholds: { minLineHeight: 1.5, centredMaxChars: null },
      })
    ).toBe('Mise en forme du texte (interligne) : 1,5 ×');
    expect(textsIn('en').formatNumber(1.5)).toBe('1.5');
  });

  it('formats the thresholds of what applies', () => {
    expect(
      textsIn('fr').appliedText('images-total-weight', {
        state: 'on',
        thresholds: { warningKb: 500, errorKb: 2048 },
      })
    ).toMatch(/^Actif · avertissement 500 Ko · erreur 2\s048 Ko$/);
  });

  it.each(['en', 'fr'])(
    'names, in %s, the checks the catalogue does not start on',
    (locale) => {
      const texts = textsIn(locale);
      const notOn = Object.keys(CHECKS).filter(
        (id) => CHECKS[id].defaultState !== 'on'
      );
      expect(notOn.length).toBeGreaterThan(0);
      const sentence = texts.defaultStatesText();
      notOn.forEach((id) => {
        expect(sentence).toContain(texts.checkName(id));
        expect(sentence).toContain(
          texts.stateName(CHECKS[id].defaultState).toLowerCase()
        );
      });
    }
  );
});

describe('what a blocking check of the server says', () => {
  it.each(['en', 'fr'])(
    'says, in %s, what each one blocks on and what it never blocks on',
    (locale) => {
      const strings = LOCALES[locale].qualitySettings;
      SERVER_CHECKS.forEach((id) => {
        expect(typeof strings.blocksOn[id]).toBe('string');
        expect(typeof strings.unverifiable[id]).toBe('string');
      });
    }
  );

  it.each(['en', 'fr'])(
    'never says, in %s, that a server error blocks',
    (locale) => {
      const strings = LOCALES[locale].qualitySettings;
      expect(strings.blocksOn['broken-links']).not.toMatch(/500/);
      expect(strings.unverifiable['broken-links']).toMatch(/500/);
    }
  );

  it.each([
    ['en', /30/],
    ['fr', /30/],
  ])('gives, in %s, the longest wait of an export', (locale, wait) => {
    expect(LOCALES[locale].qualitySettings.serverWait).toMatch(wait);
  });
});

describe('the level under the one that blocks', () => {
  const texts = textsIn('fr');

  it('says it shows without blocking when it starts below', () => {
    expect(
      texts.lowerShownText('subject', { long: 40, tooLong: 60 }, 'tooLong')
    ).toBe(
      "Au-delà de 40 caractères (info), le résultat s'affiche sans bloquer."
    );
  });

  it.each([
    ['brought up to it', { long: 50, tooLong: 50 }],
    ['past it', { long: 70, tooLong: 50 }],
  ])('says nothing when it is %s', (_case, thresholds) => {
    expect(texts.lowerShownText('subject', thresholds, 'tooLong')).toBe('');
  });

  it('says nothing for a check with a single level', () => {
    expect(texts.lowerShownText('html-size', { maxKb: 100 }, 'maxKb')).toBe('');
  });
});
