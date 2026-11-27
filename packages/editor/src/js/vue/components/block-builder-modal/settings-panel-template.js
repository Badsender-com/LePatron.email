'use strict';

// The panel on the right: the settings of whatever is selected (settings-panel.js).
//
//   - an element: where it sits, a way back to its row, and its own settings;
//   - a row: its actions, the column the palette adds to, and its structure
//     (structure-template.js);
//   - nothing: the element settings' own invitation to select something.
//
// Out of modal-template.js for the three hundred lines this repository allows
// (AGENTS.md), and inserted there as it is.
const STRUCTURE_TEMPLATE = require('./structure-template.js');

module.exports = `        <template v-if="selected">
          <div class="bb-modal__place">
            <span class="bb-modal__place-name">{{ selectedPlaceLabel }}</span>
            <button
              type="button"
              class="bb-modal__place-row"
              @click.prevent="selectRowOfSelected">{{ vm.t('block-builder-row-settings') }}</button>
          </div>
          <element-settings :element="selected" :labels="settingsLabels" @change="applySetting" @pick-image="pickImage" />
        </template>
        <template v-else-if="selectedRow">
          <p class="bb-modal__section bb-modal__row-title">{{ selectedRowTitle }}</p>
          <div v-if="selectedRow" class="bb-modal__actions bb-modal__row-actions">
            <button
              ref="rowMoveUp"
              type="button"
              class="bb-modal__action"
              :disabled="!canMoveRow(-1)"
              :title="vm.t('block-builder-move-row-up')"
              :aria-label="vm.t('block-builder-move-row-up')"
              @click.prevent="onRowMoveClick(-1)">↑</button>
            <button
              ref="rowMoveDown"
              type="button"
              class="bb-modal__action"
              :disabled="!canMoveRow(1)"
              :title="vm.t('block-builder-move-row-down')"
              :aria-label="vm.t('block-builder-move-row-down')"
              @click.prevent="onRowMoveClick(1)">↓</button>
            <button
              type="button"
              class="bb-modal__action"
              :disabled="rowLimitReached"
              :title="rowLimitReached ? vm.t('block-builder-row-limit', { max: maxRows }) : vm.t('block-builder-duplicate-row')"
              :aria-label="vm.t('block-builder-duplicate-row')"
              @click.prevent="duplicateSelectedRow">⧉</button>
            <button
              type="button"
              class="bb-modal__action bb-modal__action--destructive"
              :title="vm.t('block-builder-delete-row')"
              :aria-label="vm.t('block-builder-delete-row')"
              @click.prevent="onRowDeleteClick">✕</button>
          </div>
          <div v-if="selectedRow.columns.length > 1" class="bb-modal__column-choices">
            <p class="bb-modal__section">{{ vm.t('block-builder-add-into') }}</p>
            <div class="bb-modal__column-choice-list" role="group" :aria-label="vm.t('block-builder-add-into')">
              <button
                v-for="(column, index) in selectedRow.columns"
                :key="index"
                type="button"
                class="bb-modal__column-choice"
                :class="{ 'bb-modal__column-choice--on': isChosenColumn(index) }"
                :aria-pressed="String(isChosenColumn(index))"
                @click.prevent="selectColumn(selectedRow.id, index)">{{ vm.t('block-builder-column-label', { n: index + 1 }) }}</button>
            </div>
          </div>
${STRUCTURE_TEMPLATE}
        </template>
        <element-settings v-else :element="null" :labels="settingsLabels" />`;
