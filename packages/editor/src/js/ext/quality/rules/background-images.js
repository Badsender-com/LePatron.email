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

// The variants a block turns on, with the template's defaults for them.
function activeVariants(ctx, block) {
  const options = block && block.bgOptions;
  if (!options) return [];
  const def = getBlockDefault(ctx.blockDefs, block.type);
  const defaults = (def && def.bgOptions) || {};
  return VARIANTS.filter(
    (variant) => variant.field in options && variant.isOn(options)
  ).map((variant) => ({
    ...variant,
    // The template's default image counts as unset: it is the placeholder
    // the client was meant to replace.
    unset: isImageUnset(options[variant.field], defaults[variant.field]),
  }));
}

/** Whether a block shows a background image the client set. */
const hasBackgroundImage = (ctx, block) =>
  activeVariants(ctx, block).some((variant) => !variant.unset);

module.exports = {
  id: 'background-images',
  category: 'content',
  severity: 'warning',
  titleKey: 'Background images',
  passKey: 'Every background image turned on is set',
  hasBackgroundImage,
  run(ctx) {
    return _.flatMap(ctx.blocks, (block) =>
      activeVariants(ctx, block)
        .filter((variant) => variant.unset)
        .map((variant) => ({
          messageKey: variant.messageKey,
          blockId: block.id,
          propertyPath: `bgOptions.${variant.field}`,
          value: block.bgOptions[variant.field],
        }))
    );
  },
};
