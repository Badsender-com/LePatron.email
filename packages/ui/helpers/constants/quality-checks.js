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
  },
  preheader: {
    category: 'copy',
    defaultState: 'on',
    thresholds: {
      long: { default: 100, min: 20, max: 300, unit: 'characters' },
      tooLong: { default: 140, min: 20, max: 500, unit: 'characters' },
    },
  },
  'merge-tags': {
    category: 'copy',
    defaultState: 'on',
    thresholds: {},
  },
  'empty-blocks': {
    category: 'copy',
    defaultState: 'on',
    thresholds: {},
  },
  'uppercase-text': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {
      maxWords: { default: 5, min: 2, max: 30, unit: 'words' },
    },
  },
  'hidden-text': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
  },
  'small-font': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {
      minSize: { default: 14, min: 6, max: 24, unit: 'px' },
      minSizeHeaderFooter: { default: 12, min: 6, max: 24, unit: 'px' },
    },
  },
  'color-contrast': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
  },
  'text-layout': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {
      minLineHeight: { default: 1, min: 0.5, max: 2, unit: 'ratio' },
      centredMaxChars: { default: 200, min: 20, max: 5000, unit: 'characters' },
    },
  },
  'indistinct-links': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
  },
  headings: {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
  },
  'alt-redundant': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
  },
  'emoji-placement': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
  },
  'unnamed-image-links': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {},
  },
  'alt-text-quality': {
    category: 'accessibility',
    defaultState: 'on',
    thresholds: {
      maxLength: { default: 150, min: 20, max: 1000, unit: 'characters' },
    },
  },
  'tracking-params': {
    category: 'content',
    defaultState: 'blocking',
    thresholds: {},
  },
  'unfilled-links': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
  },
  'malformed-links': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
  },
  'displayed-urls': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
  },
  'suspicious-links': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
  },
  'images-without-link': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
  },
  'unreplaced-images': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
  },
  'background-images': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
  },
  'image-only-email': {
    category: 'content',
    defaultState: 'on',
    thresholds: {
      minTextLength: { default: 100, min: 0, max: 5000, unit: 'characters' },
    },
  },
  'broken-links': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
  },
  'dangerous-links': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
  },
  'domain-blocklists': {
    category: 'content',
    defaultState: 'on',
    thresholds: {},
  },
  'insecure-urls': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {},
  },
  'unsupported-image-formats': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {},
  },
  'forbidden-code': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {},
  },
  'malformed-html': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {},
  },
  'unsupported-code': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {},
  },
  'loose-code': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {},
  },
  'html-size': {
    category: 'technical',
    defaultState: 'on',
    thresholds: {
      maxKb: { default: 100, min: 10, max: 2048, unit: 'KB' },
    },
  },
  'image-weight': {
    category: 'performance',
    defaultState: 'on',
    thresholds: {
      maxKb: { default: 500, min: 10, max: 10240, unit: 'KB' },
      maxGifKb: { default: 1024, min: 10, max: 10240, unit: 'KB' },
    },
  },
  'images-total-weight': {
    category: 'performance',
    defaultState: 'on',
    thresholds: {
      warningKb: { default: 500, min: 10, max: 20480, unit: 'KB' },
      errorKb: { default: 1024, min: 10, max: 20480, unit: 'KB' },
    },
  },
  'oversized-images': {
    category: 'performance',
    defaultState: 'on',
    thresholds: {
      maxRatio: { default: 2, min: 1, max: 10, unit: 'ratio' },
    },
  },
};
