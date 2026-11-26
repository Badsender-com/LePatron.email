/**
 * @jest-environment node
 */

'use strict';

const {
  PRESETS,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/row-settings.js');
const {
  FULL_WIDTH,
  areLegacyWidths,
  areUsableWidths,
  widthsFromProportions,
} = require('../../../packages/shared/block-builder/row-layout.js');
const {
  MAX_GUTTER,
} = require('../../../packages/shared/block-builder/row-spacing.js');

// A preset is one click, and setRowWidths refuses a structure a row may not
// have: a preset that did not fit would be a button that silently does nothing.
// It gives proportions of what the gutters leave, so it has to fit between no
// gutter and the widest ones.
describe('the structure presets', () => {
  it.each(PRESETS.map((preset) => [preset.key, preset.widths]))(
    '%s gives proportions that add up to 100',
    (_key, widths) => {
      expect(areLegacyWidths(widths)).toBe(true);
    }
  );

  it.each(
    PRESETS.flatMap((preset) => [
      [preset.key, preset.widths, 0],
      [preset.key, preset.widths, MAX_GUTTER],
    ])
  )('%s fits the block with gutters of %i px', (_key, widths, gutter) => {
    const gutters = widths.slice(1).map(() => gutter);
    const content = FULL_WIDTH - gutter * gutters.length;

    expect(
      areUsableWidths(widthsFromProportions(widths, content), gutters)
    ).toBe(true);
  });
});
