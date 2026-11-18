import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';
import { CHECKS } from '~/helpers/constants/quality-checks.js';
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
