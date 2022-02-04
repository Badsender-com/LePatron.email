/* eslint-disable quotes */
'use strict';

const _ = require('lodash');

const DEFAULT_LOCALE = 'fr';
const translations = {
  fr: {
    'default-mailing-name': 'sans titre',
    'editor-title': 'LePatron Email Builder by Badsender',
    'editor-description':
      "Barrener Email Builder est une solution de conception d'emailing responsive permettant de construe un email graphiquement par glissé/déposé.",
  },
  en: {
    'default-mailing-name': 'untitled',
    'editor-title':
      'Email template editor by “drag & drop” - A Badsender.com solution',
    'editor-description':
      'Badsender Email Builder is an emailing responsive design solution for building an email graphically by drag & drop.',
  },
};

module.exports = function __(key, lang = DEFAULT_LOCALE) {
  const askedTranslation = _.get(translations, `${lang}.${key}`);
  if (askedTranslation) return askedTranslation;
  const defaultTranslation = _.get(translations, `${DEFAULT_LOCALE}.${key}`);
  if (defaultTranslation) return askedTranslation;
  return '';
};
