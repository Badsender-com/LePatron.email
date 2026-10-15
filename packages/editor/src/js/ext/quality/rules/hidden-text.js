'use strict';

const _ = require('lodash');
const { userDeclarations, hasText } = require('../user-styles');
const { textOf, excerpt, HIDING } = require('../exported-content');
const { toPx } = require('../inline-style');
const { HIDDEN_SIZE } = require('./small-font');

// Text the client hid by hand. Gmail's sender guidelines ask not to hide
// content with HTML and CSS: filters read it as an attempt to fool them.
// Text drawn in (almost) the colour of its background is reported by
// "color-contrast", with the same severity.
const HIDES = {
  ...HIDING,
  'font-size': (v) => {
    const px = toPx(v);
    return px !== null && px <= HIDDEN_SIZE;
  },
};

module.exports = {
  id: 'hidden-text',
  category: 'accessibility',
  severity: 'error',
  titleKey: 'Hidden text',
  passKey: 'No text is hidden',
  run(ctx) {
    const hidden = userDeclarations(ctx).filter(
      ({ prop, value, element }) =>
        HIDES[prop] && HIDES[prop](value) && hasText(element)
    );
    // One finding per element, whatever the number of hiding declarations.
    return _.uniqBy(hidden, 'element').map(({ blockId, path, element }) => ({
      messageKey:
        'Hidden text: filters read hidden content as an attempt to fool them: __text__',
      params: { text: excerpt(textOf(element)) },
      blockId,
      propertyPath: path,
      value: textOf(element),
    }));
  },
};
