/**
 * @jest-environment node
 */

'use strict';

const {
  PRESETS,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/row-settings.js');
const {
  FULL_WIDTH,
  areUsableWidths,
} = require('../../../packages/shared/block-builder/composition.js');

// A preset is one click, and setRowWidths refuses widths a row may not have:
// a preset that did not add up would be a button that silently does nothing.
describe('the structure presets', () => {
  it.each(PRESETS.map((preset) => [preset.key, preset.widths]))(
    '%s adds up to the full width',
    (key, widths) => {
      expect(widths.reduce((sum, width) => sum + width, 0)).toBe(FULL_WIDTH);
      expect(areUsableWidths(widths)).toBe(true);
    }
  );
});
