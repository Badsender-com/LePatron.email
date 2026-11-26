'use strict';

// The structure panel of the selected row: its presets, the bar that lays its
// columns and gutters out (row-layout-bar.js), and its stack spacing
// (row-spacing-settings.js). Out of modal-template.js for the three hundred
// lines this repository allows (AGENTS.md), and inserted there as it is.
module.exports = `        <div v-if="selectedRow" class="bb-modal__structure">
          <p class="bb-modal__section">{{ vm.t('block-builder-structure') }}</p>
          <div class="bb-modal__presets">
            <button
              v-for="preset in presets"
              :key="preset.key"
              type="button"
              class="bb-modal__preset"
              :class="{ 'bb-modal__preset--on': isPresetActive(preset) }"
              :aria-pressed="String(isPresetActive(preset))"
              :title="presetLabel(preset)"
              :aria-label="presetLabel(preset)"
              @click.prevent="applyPreset(preset)"><span
                v-for="(width, index) in preset.widths"
                :key="index"
                class="bb-modal__preset-cell"
                :style="{ width: width + '%' }"></span></button>
          </div>
          <div v-if="selectedRowSpaces" class="bb-modal__row-layout">
            <p class="bb-modal__row-layout-title">{{ vm.t('block-builder-row-layout') }}</p>
            <div ref="layoutBar" class="bb-modal__row-layout-bar">
              <template v-for="(piece, index) in layoutPieces">
                <div
                  :key="'piece-' + index"
                  class="bb-modal__bar-piece"
                  :class="'bb-modal__bar-piece--' + piece.kind"
                  :style="{ flexGrow: piece.size }"></div>
                <span
                  v-if="index < layoutPieces.length - 1"
                  :key="'handle-' + index"
                  class="bb-modal__bar-handle"
                  :class="{ 'bb-modal__bar-handle--dragged': layoutDrag && layoutDrag.handle === index }"
                  role="slider"
                  tabindex="0"
                  aria-orientation="horizontal"
                  :aria-label="handleLabel(index)"
                  :aria-valuenow="piece.size"
                  :aria-valuemin="handleBounds(index).min"
                  :aria-valuemax="handleBounds(index).max"
                  :aria-valuetext="piece.size + ' px'"
                  @pointerdown="onHandlePointerDown($event, index)"
                  @keydown="onHandleKeydown($event, index)"></span>
              </template>
            </div>
            <div class="bb-modal__bar-sizes" aria-hidden="true">
              <span
                v-for="(piece, index) in layoutPieces"
                :key="index"
                class="bb-modal__bar-size"
                :class="'bb-modal__bar-size--' + piece.kind"
                :style="{ flexGrow: piece.size }">{{ piece.size }}</span>
            </div>
            <div class="bb-modal__pieces">
              <div
                v-for="(piece, index) in layoutPieces"
                :key="index"
                class="bb-modal__piece"
                :class="'bb-modal__piece--' + piece.kind">
                <span :id="pieceLabelId(index)" class="bb-modal__piece-label">{{ pieceLabel(index) }}</span>
                <input
                  type="number"
                  step="1"
                  :min="pieceBounds(index).min"
                  :max="pieceBounds(index).max"
                  :value="piece.size"
                  :aria-labelledby="pieceLabelId(index)"
                  :disabled="index === layoutPieces.length - 1"
                  @change="onPieceChange($event, index)" />
                <span aria-hidden="true">px</span>
              </div>
            </div>
          </div>
          <div v-if="selectedRowSpaces" class="bb-modal__spacing">
            <span :id="stackSpacingLabelId" class="bb-modal__spacing-label">{{ vm.t('block-builder-stack-spacing') }}</span>
            <input
              type="number"
              min="0"
              :max="maxStackSpacing"
              :step="stackSpacingStep"
              :value="selectedRowStackSpacing"
              :aria-labelledby="stackSpacingLabelId"
              :aria-describedby="stackSpacingHintId"
              @change="onStackSpacingChange($event)" />
            <span aria-hidden="true">px</span>
            <p :id="stackSpacingHintId" class="bb-modal__spacing-hint">{{ stackSpacingHint }}</p>
          </div>
          <p class="bb-modal__folded" role="status">{{ foldedMessage }}</p>
        </div>`;
