'use strict';

// The modal's markup.
//
// Out of the component file only because that file was past the three hundred
// lines this repository allows (AGENTS.md), and a template is the one part that
// splits without taking any behaviour with it — Vue reads it as a string.
//
// It is read by the component and by nothing else; every binding it names lives
// there or in one of its mixins.
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

    <div class="bb-modal__layout">
      <div class="bb-modal__column bb-modal__column--left">
        <p class="bb-modal__section">{{ vm.t('block-builder-add') }}</p>
        <button
          v-for="item in palette"
          :key="item.type"
          type="button"
          class="bb-modal__add"
          :class="{ 'bb-modal__add--dragging': draggingType === item.type }"
          draggable="true"
          @dragstart="handleDragStart(item.type, $event)"
          @drag="handleDrag"
          @dragend="handleDragEnd"
          @click.prevent="addElement(item.type)">+ {{ vm.t(item.labelKey) }}</button>

        <p :id="listLabelId" class="bb-modal__section">{{ vm.t('block-builder-elements') }}</p>
        <p v-if="isEmpty" class="bb-modal__empty">{{ vm.t('block-builder-empty') }}</p>
        <ul v-else class="bb-modal__list" role="listbox" :aria-labelledby="listLabelId">
          <li
            v-for="(element, index) in state.elements"
            :key="element.id"
            role="option"
            :aria-selected="String(element.id === selectedId)"
            :tabindex="optionTabIndex(index)"
            class="bb-modal__item"
            :class="{ 'bb-modal__item--on': element.id === selectedId }"
            @click="selectedId = element.id"
            @keydown="onOptionKeydown($event, index)">{{ labelFor(element) }}</li>
        </ul>
        <div v-if="selected" class="bb-modal__actions">
          <button
            type="button"
            :disabled="!canMove(-1)"
            :title="vm.t('block-builder-move-up')"
            :aria-label="vm.t('block-builder-move-up')"
            @click.prevent="move(-1)">↑</button>
          <button
            type="button"
            :disabled="!canMove(1)"
            :title="vm.t('block-builder-move-down')"
            :aria-label="vm.t('block-builder-move-down')"
            @click.prevent="move(1)">↓</button>
          <button
            type="button"
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
