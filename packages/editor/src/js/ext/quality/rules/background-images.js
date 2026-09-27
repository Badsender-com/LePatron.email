'use strict';

const _ = require('lodash');
const { getBlockDefault, isImageUnset } = require('../ownership');

// The background image options of our templates (`bgOptions`), one entry per
// variant: when the client turns the variant on, its image must be set.
const VARIANTS = [
  {
    field: 'outlookBgImage',
    messageKey: 'Missing Outlook background image',
    isOn: (o) => Boolean(o.outlookBgImageVisible),
  },
  {
    field: 'mobileBgimage',
    messageKey: 'Missing mobile background image',
    isOn: (o) => o.mobileBgImageChoice === 'mobile',
  },
  {
    field: 'bgimage',
    messageKey: 'Missing background image',
    isOn: (o) => o.bgImageChoice === 'custom' || Boolean(o.bgImageVisible),
  },
];

module.exports = {
  id: 'background-images',
  category: 'content',
  severity: 'warning',
  run(ctx) {
    return _.flatMap(ctx.blocks, (block) => {
      const options = block && block.bgOptions;
      if (!options) return [];
      const def = getBlockDefault(ctx.blockDefs, block.type);
      const defaults = (def && def.bgOptions) || {};
      return VARIANTS.filter(
        (variant) =>
          variant.field in options &&
          variant.isOn(options) &&
          // The template's default image counts as unset: it is the
          // placeholder the client was meant to replace.
          isImageUnset(options[variant.field], defaults[variant.field])
        ).map((variant) => ({
        messageKey: variant.messageKey,
        blockId: block.id,
        propertyPath: `bgOptions.${variant.field}`,
        value: options[variant.field],
      }));
    });
  },
};
