'use strict';

// Markup of the gallery thumbnail, kept out of thumb.js so neither file grows
// past what is comfortable to read, as panel.template.js does for the panel.
// Why the image is the control and the action bar its sibling: thumb.js.

module.exports = `
    <div
      class="gallery-thumb"
      @click="editing || $emit('select', file)"
      @mouseenter="$emit('hover', file, $event.currentTarget)"
      @mouseleave="$emit('unhover')"
    >
      <span v-if="isGif" class="gallery-thumb__badge gallery-thumb__badge--gif">GIF</span>
      <div class="gallery-thumb__media">
        <div
          class="gallery-thumb__img"
          :class="{ 'gallery-thumb__img--solid': isSolid }"
          ref="pick"
          role="button"
          tabindex="0"
          :aria-label="label"
          data-gallery-pick
          @keydown.enter.prevent="$emit('select', file)"
          @keydown.space.prevent="$emit('select', file)"
        >
          <img :src="file.thumbnailUrl" :alt="label" />
        </div>
        <!-- Actions on hover, inside the image area only: the label band
             below stays reachable, which is what a rename double-click needs
             (ADR-0005). The overlay keeps \`pointer-events: none\` even while
             visible and only the small bar takes the pointer back: a lid over
             the image would have made the thumbnail undraggable while shown,
             since jQuery UI's draggable excludes buttons from its handle. -->
        <div class="gallery-thumb__overlay" data-gallery-overlay>
          <div v-if="hasActions" class="gallery-thumb__actions">
            <button
              v-if="canEdit"
              type="button"
              class="gallery-thumb__action"
              data-gallery-edit
              :title="editTitle"
              :aria-label="editTitle"
              @mousedown.prevent
              @click.stop="$emit('edit', file, $event.currentTarget)"
            >
              <span class="lucide lucide-pencil"></span>
            </button>
            <button
              v-if="actions.rename"
              ref="renameButton"
              type="button"
              class="gallery-thumb__action"
              data-gallery-rename
              :title="renameTitle"
              :aria-label="renameTitle"
              @mousedown.prevent
              @click.stop="startEdit"
            >
              <span class="lucide lucide-tag"></span>
            </button>
            <button
              v-if="actions.remove"
              type="button"
              class="gallery-thumb__action gallery-thumb__action--danger"
              data-gallery-remove
              :title="removeTitle"
              :aria-label="removeTitle"
              @mousedown.prevent="onRemoveDown"
              @click.stop="$emit('remove', file)"
            >
              <span class="lucide lucide-trash-2"></span>
            </button>
          </div>
        </div>
      </div>
      <input
        v-if="editing"
        ref="input"
        v-model="draft"
        type="text"
        class="gallery-thumb__label gallery-thumb__label--editing"
        data-gallery-label-input
        :maxlength="maxLength"
        :aria-label="strings.renameInput"
        @click.stop
        @dblclick.stop
        @keydown.enter="onEnter"
        @keydown.esc="onEscape"
        @blur="commitEdit"
      />
      <div
        v-else
        class="gallery-thumb__label"
        data-gallery-label
        @click="onLabelClick"
        @dblclick.stop="startEdit"
      >{{ label }}</div>
    </div>
`;
