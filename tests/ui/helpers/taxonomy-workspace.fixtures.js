'use strict';

// One company's taxonomy, as the taxonomy workspace loads it (epic #1547): its
// dimensions, their values and its templates' contracts. The worked example of
// every helper test of the workspace, the same one as the reviewed mock-up.
//
//   emailType (standard)        Newsletter
//   trigger (standard)          its two doctrine values, never taxonomy items
//   market   role country       France, Belgique, Suisse, Canada, Allemagne
//     language  role language   Français (fr, be, ch), Néerlandais (be),
//                               Allemand (ch), Anglais (ca, default under ca),
//                               Italien (ch, no normalised code)
//   brand    templates reading  Atlas, Nova
//     range  templates reading  Junior (under Atlas)
//   audience every email        no value yet

const dimension = (name, label, extra = {}) => ({
  id: `dim-${name}`,
  name,
  label,
  standard: false,
  isActive: true,
  parentName: null,
  role: null,
  scope: 'all',
  order: 0,
  precedence: 0,
  ...extra,
});

const value = (id, type, label, extra = {}) => ({
  id,
  type,
  label,
  canonicalType: id.split('-')[1],
  code: null,
  isActive: true,
  isDefault: false,
  order: 0,
  _parents: [],
  defaultUnder: [],
  tokens: {},
  ...extra,
});

const DIMENSIONS = [
  dimension('audience', 'Cible', { order: 40 }),
  dimension('range', 'Gamme', {
    parentName: 'brand',
    scope: 'readingTemplates',
    order: 10,
    precedence: 20,
  }),
  dimension('brand', 'Marque', {
    scope: 'readingTemplates',
    order: 30,
    precedence: 10,
  }),
  dimension('language', 'Langue', {
    parentName: 'market',
    role: 'language',
    order: 20,
  }),
  dimension('market', 'Marché', { role: 'country', order: 10 }),
  dimension('trigger', 'Déclenchement', { standard: true, order: 60 }),
  dimension('emailType', 'Typologie', { standard: true, order: 50 }),
];

const VALUES = [
  value('et-newsletter', 'emailType', 'Newsletter'),
  value('mk-fr', 'market', 'France', { code: 'FR', order: 1 }),
  value('mk-be', 'market', 'Belgique', { code: 'BE', order: 2 }),
  value('mk-ch', 'market', 'Suisse', { code: 'CH', order: 3 }),
  value('mk-ca', 'market', 'Canada', { code: 'CA', order: 4 }),
  value('mk-de', 'market', 'Allemagne', { code: 'DE', order: 5 }),
  value('lg-fr', 'language', 'Français', {
    code: 'fr',
    order: 1,
    _parents: ['mk-fr', 'mk-be', 'mk-ch'],
    defaultUnder: ['mk-fr', 'mk-be', 'mk-ch'],
  }),
  value('lg-nl', 'language', 'Néerlandais', {
    code: 'nl',
    order: 2,
    _parents: ['mk-be'],
  }),
  value('lg-de', 'language', 'Allemand', {
    code: 'de',
    order: 3,
    _parents: ['mk-ch'],
  }),
  value('lg-en', 'language', 'Anglais', {
    code: 'en',
    order: 4,
    _parents: ['mk-ca'],
    defaultUnder: ['mk-ca'],
  }),
  value('lg-it', 'language', 'Italien', { order: 5, _parents: ['mk-ch'] }),
  value('br-atlas', 'brand', 'Atlas', {
    isDefault: true,
    tokens: {
      mainColorVar: '#265090',
      logoUrl: 'atlas.png',
      ctaColorVar: '#ff0000',
    },
  }),
  value('br-nova', 'brand', 'Nova', {
    tokens: { mainColorVar: '#ffb400', logoUrl: 'nova.png' },
  }),
  value('rg-junior', 'range', 'Junior', {
    _parents: ['br-atlas'],
    tokens: { accentColorVar: '#00acdc' },
  }),
];

// `compared` is what the version 3 reader records (#1554).
const TEMPLATES = [
  {
    id: 'tpl-newsletter',
    name: 'Newsletter v4',
    contract: {
      declared: { market: 'fr' },
      read: ['market', 'language', 'brand', 'mainColorVar', 'logoUrl'],
      adopt: {},
      compared: {
        market: { fr: 2, be: 1, uk: 1 },
        language: { fr: 1 },
      },
    },
  },
  {
    id: 'tpl-transactional',
    name: 'Transactionnel',
    contract: {
      declared: {},
      read: ['market'],
      adopt: {},
      compared: { market: { be: 1 } },
    },
  },
  {
    id: 'tpl-catalogue',
    name: 'Catalogue',
    contract: { declared: {}, read: ['range'], adopt: {}, compared: {} },
  },
];

module.exports = { DIMENSIONS, VALUES, TEMPLATES };
