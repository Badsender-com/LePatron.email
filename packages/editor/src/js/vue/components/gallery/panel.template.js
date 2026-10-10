'use strict';

/**
 * Markup of the gallery panel, kept out of the plugin so neither file grows past
 * what is comfortable to read — same split as email-metadata.template.js.
 *
 * Bare Vue with an inline string template: the editor's gulp/browserify build
 * compiles no `.vue` files, and Vuetify's global CSS would collide with
 * Mosaico's in the same DOM (see AGENTS.md, packages/editor).
 */

module.exports = `
    <div class="gallery-vue-panel" data-gallery-vue="ready">
      <div v-if="showToolbar" class="gallery-vue-search">
        <span class="lucide lucide-search gallery-vue-search__icon"></span>
        <input
          ref="searchInput"
          v-model="search"
          type="search"
          class="gallery-vue-search__input"
          data-gallery-search
          :placeholder="searchPlaceholder"
          :aria-label="searchPlaceholder"
        />
        <button
          v-if="isSearching"
          type="button"
          class="gallery-vue-search__clear"
          :title="clearSearchLabel"
          :aria-label="clearSearchLabel"
          @click="clearSearch"
        >
          <span class="lucide lucide-x"></span>
        </button>
      </div>
      <div v-if="showToolbar" class="gallery-vue-filters">
        <div class="gallery-vue-chips" role="group" :aria-label="formatGroupLabel">
          <button
            v-for="f in formats"
            :key="'fmt-' + f"
            type="button"
            class="gallery-vue-chip"
            :class="{ 'gallery-vue-chip--active': format === f }"
            :aria-pressed="String(format === f)"
            data-gallery-format
            @click="format = f"
          >{{ formatLabel(f) }}</button>
        </div>
        <div class="gallery-vue-chips" role="group" :aria-label="sortGroupLabel">
          <button
            v-for="s in sorts"
            :key="'sort-' + s"
            type="button"
            class="gallery-vue-chip"
            :class="{ 'gallery-vue-chip--active': sortBy === s }"
            :aria-pressed="String(sortBy === s)"
            :title="sortTitle(s)"
            :aria-label="sortTitle(s)"
            data-gallery-sort
            @click="sortBy = s"
          >{{ sortLabel(s) }}</button>
        </div>
      </div>
      <div
        class="gallery-vue-panel__count"
        aria-live="polite"
        aria-atomic="true"
      >{{ countLabel }}</div>
      <p
        v-if="hasNoResult"
        class="gallery-vue-panel__empty"
        role="status"
        data-gallery-no-result
      >{{ noResultLabel }}</p>
      <p
        v-else-if="isEmptyGallery"
        class="gallery-vue-panel__empty"
        data-gallery-empty
      >{{ emptyGalleryLabel }}</p>
      <recycle-scroller
        v-else
        ref="scroller"
        class="gallery-vue-scroller"
        :items="visibleImages"
        :item-size="cellSize"
        :grid-items="gridColumns"
        :item-secondary-size="cellSize"
        key-field="name"
        v-slot="{ item, index }"
      >
        <!-- the scroller recycles its views, so DOM order is pool order, not
             list order: the index is the only reliable handle on position -->
        <div class="gallery-vue-cell" :data-gallery-index="index">
          <thumb
            v-gallery-draggable="item"
            :file="item"
            :strings="thumbStrings"
            @select="onSelect"
            @remove="onRemove"
            @rename="onRename"
            @reject="onRenameRejected"
            @hover="onHover"
            @unhover="onUnhover"
          />
        </div>
      </recycle-scroller>
      <tooltip
        :file="hoveredFile"
        :anchor="hoveredAnchor"
        :bounds="panelBounds"
        :strings="tooltipStrings"
      />
    </div>
`;
