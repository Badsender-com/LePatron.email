'use strict';

// Tone requested from the translation provider (DeepL only so far).
//
// Three levels, not the five DeepL knows. The setting is per group, while a
// group translates into several languages, and DeepL rejects a strict
// `more`/`less` for every target language that has no formality (English,
// Chinese…). DeepLProvider therefore sends the `prefer_*` variants, which
// apply the tone where the language allows it and stay neutral elsewhere: a
// "strict" level would only have meant "fail on English".
const TranslationFormalities = {
  DEFAULT: 'default',
  MORE: 'more',
  LESS: 'less',
};

const TranslationFormalityValues = Object.values(TranslationFormalities);

module.exports = TranslationFormalities;
module.exports.TranslationFormalityValues = TranslationFormalityValues;
