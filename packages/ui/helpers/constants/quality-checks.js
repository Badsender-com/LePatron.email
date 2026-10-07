// The quality control's checks, for the "Contrôle qualité" settings page.
//
// A copy of packages/shared/quality/checks.js, which the Nuxt app does not
// import: tests/ui/helpers/quality-checks-sync.test.js keeps the two equal, so
// the page never offers a setting the server would refuse.

export const CHECK_STATES = ['off', 'on', 'blocking'];

// In the order the page lists them: by category, as the editor's drawer does.
export const CHECK_CATEGORIES = [
  'copy',
  'accessibility',
  'content',
  'technical',
  'performance',
];

export const CHECKS = {
  subject: {
    category: 'copy',
    defaultState: 'on',
    thresholds: {
      long: { default: 40, min: 10, max: 200, unit: 'characters' },
      tooLong: { default: 60, min: 10, max: 255, unit: 'characters' },
    },
    ordered: [['long', 'tooLong']],
  },
  preheader: {
    category: 'copy',
    defaultState: 'on',
    thresholds: {
      long: { default: 100, min: 20, max: 300, unit: 'characters' },
      tooLong: { default: 140, min: 20, max: 500, unit: 'characters' },
    },
    ordered: [['long', 'tooLong']],
  },
  'merge-tags': {
    category: 'copy',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'empty-blocks': {
    category: 'copy',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'uppercase-text': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {
      maxWords: { default: 5, min: 2, max: 30, unit: 'words' },
    },
    ordered: [],
  },
  'hidden-text': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'small-font': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {
      minSize: { default: 14, min: 6, max: 24, unit: 'px' },
      minSizeHeaderFooter: { default: 12, min: 6, max: 24, unit: 'px' },
    },
    ordered: [],
  },
  'color-contrast': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'text-layout': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {
      minLineHeight: { default: 1, min: 0.5, max: 2, unit: 'ratio' },
      centredMaxChars: { default: 200, min: 20, max: 5000, unit: 'characters' },
    },
    ordered: [],
  },
  'indistinct-links': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  headings: {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'alt-redundant': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'emoji-placement': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'unnamed-image-links': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'alt-text-quality': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {
      maxLength: { default: 150, min: 20, max: 1000, unit: 'characters' },
    },
    ordered: [],
  },
  'tracking-params': {
    category: 'content',
    defaultState: 'blocking',
    thresholds: {},
    ordered: [],
  },
  'unfilled-links': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'malformed-links': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'displayed-urls': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'suspicious-links': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'images-without-link': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'unreplaced-images': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'background-images': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'image-only-email': {
    category: 'content',
    defaultState: 'on',
    thresholds: {
      minTextLength: { default: 100, min: 0, max: 5000, unit: 'characters' },
    },
    ordered: [],
  },
  'broken-links': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'dangerous-links': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'domain-blocklists': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'insecure-urls': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'unsupported-image-formats': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'forbidden-code': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'malformed-html': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'unsupported-code': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'loose-code': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {},
    ordered: [],
  },
  'html-size': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {
      maxKb: { default: 100, min: 10, max: 2048, unit: 'KB' },
    },
    ordered: [],
  },
  'image-weight': {
    category: 'performance',
    defaultState: 'on',
    thresholds: {
      maxKb: { default: 500, min: 10, max: 10239, unit: 'KB' },
      maxGifKb: { default: 1024, min: 10, max: 10239, unit: 'KB' },
    },
    ordered: [],
  },
  'images-total-weight': {
    category: 'performance',
    defaultState: 'on',
    thresholds: {
      warningKb: { default: 500, min: 10, max: 20480, unit: 'KB' },
      errorKb: { default: 1024, min: 10, max: 20480, unit: 'KB' },
    },
    ordered: [['warningKb', 'errorKb']],
  },
  'oversized-images': {
    category: 'performance',
    defaultState: 'on',
    thresholds: {
      maxRatio: { default: 2, min: 1, max: 10, unit: 'ratio' },
    },
    ordered: [],
  },
};
