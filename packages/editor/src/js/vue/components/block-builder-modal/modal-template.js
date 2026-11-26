'use strict';

// The modal's markup.
//
// Out of the component file only because that file was past the three hundred
// lines this repository allows (AGENTS.md), and a template is the one part that
// splits without taking any behaviour with it — Vue reads it as a string.
//
// It is read by the component and by nothing else; every binding it names lives
// there or in one of its mixins.
const STRUCTURE_TEMPLATE = require('./structure-template.js');

module.exports = `<modal-component
  ref="modalRef"
  :is-full-width="true"
  :before-dismiss="confirmDismiss"
  :on-close="resetComposition">
  <div class="modal-content bb-modal">
    <h5 class="bb-modal__title">{{ vm.t('block-builder-modal-title') }}</h5>

    <p v-if="replacesExistingMarkup" class="bb-modal__warning">
      {{ vm.t('block-builder-replaces-markup') }}
    </p>
    <p v-if="rebuildsMarkup" class="bb-modal__notice">
      {{ vm.t('block-builder-rebuilds-markup') }}
    </p>
    <p v-if="tooLarge" class="bb-modal__error" role="alert">
      {{ vm.t('block-builder-too-large') }}
    </p>
    <p v-if="tooManyRows" class="bb-modal__error" role="alert">
      {{ vm.t('block-builder-too-many-rows', { max: maxRows }) }}
    </p>

    <div class="bb-modal__layout">
      <div class="bb-modal__column bb-modal__column--left">
        <p class="bb-modal__section">{{ vm.t('block-builder-add') }}</p>
        <div
          v-for="item in palette"
          :key="item.type"
          role="button"
          tabindex="0"
          class="bb-modal__add"
          :class="{ 'bb-modal__add--dragging': fadedType === item.type }"
          draggable="true"
          @dragstart="handleDragStart(item.type, $event)"
          @drag="handleDrag"
          @dragend="handleDragEnd"
          @click="addElement(item.type)"
          @keydown="onPaletteKeydown($event, item.type)"
          @keyup="onPaletteKeyup($event, item.type)">+ {{ vm.t(item.labelKey) }}</div>

        <p class="bb-modal__section">{{ vm.t('block-builder-rows') }}</p>
        <div
          class="bb-modal__rows-drop"
          :class="{
            'bb-modal__rows-drop--active': draggingRowId !== null,
            'bb-modal__rows-drop--end': rowDropIndex === state.rows.length
          }"
          @dragenter="handleRowDragOver"
          @dragover="handleRowDragOver"
          @dragleave="handleRowDragLeave"
          @drop="handleRowDrop">
          <ul class="bb-modal__rows" role="listbox" :aria-label="vm.t('block-builder-rows')">
            <li
              v-for="(row, index) in state.rows"
              :key="row.id"
              role="option"
              :aria-selected="String(row.id === selectedRowId)"
              :tabindex="rowTabIndex(index)"
              class="bb-modal__row"
              :class="{
                'bb-modal__row--on': row.id === selectedRowId,
                'bb-modal__row--drop-before': index === rowDropIndex
              }"
              draggable="true"
              :aria-keyshortcuts="rowMoveShortcuts"
              @click="selectRow(row.id)"
              @keydown="onRowKeydown($event, index)"
              @dragstart="startRowDrag(row.id, $event)"
              @drag="handleDrag"
              @dragend="handleDragEnd">{{ rowLabel(row, index) }}</li>
          </ul>
        </div>
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
        <button
          ref="addRowButton"
          type="button"
          class="bb-modal__add-row"
          :disabled="rowLimitReached"
          :title="rowLimitReached ? vm.t('block-builder-row-limit', { max: maxRows }) : null"
          :aria-describedby="rowLimitReached ? rowLimitHintId : null"
          @click.prevent="addRow">+ {{ vm.t('block-builder-add-row') }}</button>
        <p v-if="rowLimitReached" :id="rowLimitHintId" class="bb-modal__row-limit">
          {{ vm.t('block-builder-row-limit', { max: maxRows }) }}
        </p>

${STRUCTURE_TEMPLATE}

        <p :id="listLabelId" class="bb-modal__section">{{ vm.t('block-builder-elements') }}</p>
        <p v-if="columnTitle" :id="columnTitleId" class="bb-modal__list-column">{{ columnTitle }}</p>
        <p v-if="columnElements.length === 0" class="bb-modal__empty">{{ vm.t('block-builder-empty') }}</p>
        <ul v-else class="bb-modal__list" role="listbox" :aria-labelledby="listLabelledBy">
          <li
            v-for="(element, index) in columnElements"
            :key="element.id"
            role="option"
            :aria-selected="String(element.id === selectedElementId)"
            :tabindex="optionTabIndex(index)"
            class="bb-modal__item"
            :class="{ 'bb-modal__item--on': element.id === selectedElementId }"
            @click="selectElement(element.id)"
            @keydown="onOptionKeydown($event, index)">{{ labelFor(element) }}</li>
        </ul>
        <div v-if="selected" class="bb-modal__actions">
          <button
            type="button"
            class="bb-modal__action"
            :disabled="!canMove(-1)"
            :title="vm.t('block-builder-move-up')"
            :aria-label="vm.t('block-builder-move-up')"
            @click.prevent="move(-1)">↑</button>
          <button
            type="button"
            class="bb-modal__action"
            :disabled="!canMove(1)"
            :title="vm.t('block-builder-move-down')"
            :aria-label="vm.t('block-builder-move-down')"
            @click.prevent="move(1)">↓</button>
          <button
            type="button"
            class="bb-modal__action bb-modal__action--destructive"
            :title="vm.t('block-builder-remove')"
            :aria-label="vm.t('block-builder-remove')"
            @click.prevent="removeSelected">✕</button>
        </div>
      </div>

      <div class="bb-modal__column bb-modal__column--preview">
        <div class="bb-modal__toolbar">
          <button
            type="button"
            :class="{ 'bb-modal__toggle--on': previewWidth === desktopWidth }"
            :aria-pressed="String(previewWidth === desktopWidth)"
            @click.prevent="previewWidth = desktopWidth">{{ vm.t('block-builder-desktop') }}</button>
          <button
            type="button"
            :class="{ 'bb-modal__toggle--on': previewWidth === mobileWidth }"
            :aria-pressed="String(previewWidth === mobileWidth)"
            @click.prevent="previewWidth = mobileWidth">{{ vm.t('block-builder-mobile') }}</button>
        </div>
        <div class="bb-modal__stage">
          <iframe
            ref="previewFrame"
            class="bb-modal__frame"
            :style="{ width: previewWidth + 'px' }"
            sandbox="allow-same-origin"
            :title="vm.t('block-builder-preview-title')"></iframe>
        </div>
        <p class="bb-modal__hint">{{ vm.t('block-builder-preview-hint') }}</p>
      </div>

      <div class="bb-modal__column bb-modal__column--right">
        <element-settings :element="selected" :labels="settingsLabels" @change="applySetting" @pick-image="pickImage" />
      </div>
    </div>
  </div>
  <div class="modal-footer">
    <button @click.prevent="closeModal" class="btn-flat waves-effect waves-light" name="closeAction">
      {{ vm.t('html-code-modal-cancel') }}
    </button>
    <button
      @click.prevent="handleApply"
      class="btn waves-effect waves-light"
      type="submit"
      name="submitAction">
      {{ vm.t('html-code-modal-apply') }}
    </button>
  </div>
</modal-component>`;
