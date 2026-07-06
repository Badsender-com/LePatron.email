const Vue = require('vue/dist/vue.common');
const axios = require('axios');
const { ModalComponent } = require('../modal/modalComponent');
const {
  getFeedMappingsForTemplate,
  getFeedItems,
  uploadGalleryImageFromUrl,
} = require('../../utils/apis');
const {
  injectBlockTranslations,
} = require('../../../utils/block-content-extractor');

const MANUAL_ITEMS_LIMIT = 20;

// `columnMapping` is now a free-form { [blockFieldPath]: feedPropertyName }
// map — any number of block fields, each pointing at one of the feed's real
// normalized properties (title/link/description/image/pubDate), or at the
// `ctaLabel` sentinel meaning "use the mapping's static default label".
function buildFieldValues(columnMapping, item, imageSrc, ctaDefaultLabel) {
  const values = {};
  Object.keys(columnMapping).forEach((blockFieldPath) => {
    const feedProperty = columnMapping[blockFieldPath];
    if (feedProperty === 'image') {
      values[blockFieldPath] = imageSrc;
    } else if (feedProperty === 'ctaLabel') {
      values[blockFieldPath] = ctaDefaultLabel || '';
    } else {
      values[blockFieldPath] = item[feedProperty] || '';
    }
  });
  return values;
}

function columnNeedsImage(columnMapping) {
  return Object.values(columnMapping).indexOf('image') !== -1;
}

const ContentFeedModalComponent = Vue.component('ContentFeedModal', {
  components: { ModalComponent },
  props: {
    vm: { type: Object, default: () => ({}) },
  },
  data: () => ({
    blockData: null,
    blockObservable: null,
    mappings: [],
    activeMappingId: null,
    items: [],
    isLoadingItems: false,
    isSubmitting: false,
    selectedKeys: [],
    dragKey: null,
    dragOverKey: null,
  }),
  computed: {
    activeMapping() {
      return (
        this.mappings.find((mapping) => mapping._id === this.activeMappingId) ||
        this.mappings[0] ||
        null
      );
    },
    columnCount() {
      return this.activeMapping?.fieldMapping?.length || 1;
    },
    isMultiColumn() {
      return this.columnCount > 1;
    },
    // Multi-column blocks fill their columns from the current selection —
    // there's nowhere to put more items than there are columns. Single-
    // column blocks keep the "pick as many as you like" behavior.
    maxSelectable() {
      return this.isMultiColumn ? this.columnCount : Infinity;
    },
    orderedSelectedItems() {
      return this.selectedKeys
        .map((key) => this.items.find((item) => item._key === key))
        .filter(Boolean);
    },
    canSubmit() {
      return (
        !this.isSubmitting &&
        !this.isLoadingItems &&
        this.orderedSelectedItems.length > 0
      );
    },
  },
  mounted() {
    this.vm.toggleContentFeedModal = this.handleToggleModal;
  },
  methods: {
    openModal() {
      this.$refs.modalRef?.openModal();
    },
    closeModal() {
      this.blockData = null;
      this.blockObservable = null;
      this.mappings = [];
      this.activeMappingId = null;
      this.items = [];
      this.selectedKeys = [];
      this.$refs.modalRef?.closeModal();
    },
    handleToggleModal(isOpen, data) {
      if (isOpen && data) {
        this.blockData = data.block;
        this.blockObservable = data.blockObservable;
        this.openModal();
        this.fetchMappingsAndItems();
      } else {
        this.closeModal();
      }
    },
    async fetchMappingsAndItems() {
      const templateId = this.vm.currentMailing()?.templateId;
      const blockName = this.blockData?.type;
      if (!templateId || !blockName) return;

      try {
        const response = await axios.get(
          getFeedMappingsForTemplate(templateId)
        );
        this.mappings = (response.data?.items || []).filter(
          (mapping) => mapping.blockName === blockName
        );
        this.activeMappingId = this.mappings[0]?._id || null;
        if (this.activeMapping) this.fetchItems();
      } catch (error) {
        this.mappings = [];
      }
    },
    async fetchItems() {
      if (!this.activeMapping) return;

      this.isLoadingItems = true;
      this.selectedKeys = [];
      try {
        const response = await axios.get(
          getFeedItems(this.activeMapping._integration, MANUAL_ITEMS_LIMIT)
        );
        this.items = (response.data?.items || []).map((item, index) => ({
          ...item,
          _key: index,
        }));
      } catch (error) {
        this.vm.notifier.error(this.vm.t('content-feed-fetch-error'));
        this.items = [];
      } finally {
        this.isLoadingItems = false;
      }
    },
    isSelectionDisabled(key) {
      return (
        !this.selectedKeys.includes(key) &&
        this.selectedKeys.length >= this.maxSelectable
      );
    },
    // Drag-and-drop reordering of the already-selected items — the order
    // determines which column each item fills (multi-column) or which
    // block ends up first vs. stacked after (single-column).
    //
    // The actual reorder only happens on `drop`, never during `dragover` —
    // mutating the list mid-drag would reshuffle the DOM nodes under the
    // cursor while the browser's native drag session is still tracking the
    // original element, which is a well-known way to cancel that session
    // outright. `dragOverKey` only drives a CSS class for visual feedback,
    // so nothing in the DOM actually moves until the drag is done.
    //
    // Firefox also refuses to start a native drag at all unless dataTransfer
    // has data set on it in the dragstart handler — Chrome is more lenient,
    // but relying on that would silently break this in Firefox.
    onDragStart(event, key) {
      this.dragKey = key;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(key));
    },
    onDragEnter(key) {
      if (this.dragKey !== null && this.dragKey !== key) {
        this.dragOverKey = key;
      }
    },
    onDrop(key) {
      const from = this.selectedKeys.indexOf(this.dragKey);
      const to = this.selectedKeys.indexOf(key);
      this.dragOverKey = null;
      if (this.dragKey === null || this.dragKey === key) return;
      if (from === -1 || to === -1) return;

      const reordered = [...this.selectedKeys];
      reordered.splice(from, 1);
      reordered.splice(to, 0, this.dragKey);
      this.selectedKeys = reordered;
    },
    onDragEnd() {
      this.dragKey = null;
      this.dragOverKey = null;
    },
    // The app's own image-resize proxy only knows about files it has stored
    // itself — it can't resolve an arbitrary external URL — so the feed
    // item's image is downloaded and pushed into this mailing's gallery
    // first, exactly like a manual upload. On failure, the block still gets
    // filled in (title/paragraph/CTA), just without an image.
    async resolveImageSrc(imageUrl) {
      if (!imageUrl) return '';
      const mailingId = this.vm.currentMailing()?.id;
      if (!mailingId) return '';

      try {
        const response = await axios.post(
          uploadGalleryImageFromUrl(mailingId),
          { url: imageUrl }
        );
        return response.data?.files?.[0]?.url || '';
      } catch (error) {
        this.vm.notifier.error(this.vm.t('content-feed-image-error'));
        return '';
      }
    },
    async handleSubmit() {
      const mapping = this.activeMapping;
      const items = this.orderedSelectedItems;
      if (!mapping || items.length === 0 || this.isSubmitting) return;

      this.isSubmitting = true;

      if (mapping.fieldMapping.length > 1) {
        await this.fillBlockColumns(items, mapping);
      } else {
        await this.insertSeparateBlocks(items, mapping);
      }

      this.vm.notifier.success(this.vm.t('content-feed-success'));
      this.isSubmitting = false;
      this.closeModal();
    },
    // Multi-column block: one instance (the block this modal was opened
    // from), each selected item fills a different column of it in place —
    // no new blocks are added.
    async fillBlockColumns(items, mapping) {
      for (let i = 0; i < items.length; i += 1) {
        const columnMapping = mapping.fieldMapping[i];
        const imageSrc = columnNeedsImage(columnMapping)
          ? await this.resolveImageSrc(items[i].image)
          : '';
        const values = buildFieldValues(
          columnMapping,
          items[i],
          imageSrc,
          mapping.ctaDefaultLabel
        );
        injectBlockTranslations(this.blockObservable, values);
      }
    },
    // Single-column block: the first selected item fills the block this
    // modal was opened from in place; the rest become new blocks inserted
    // right after it, in order.
    async insertSeparateBlocks(items, mapping) {
      const columnMapping = mapping.fieldMapping[0];
      const needsImage = columnNeedsImage(columnMapping);

      for (let i = 0; i < items.length; i += 1) {
        const imageSrc = needsImage
          ? await this.resolveImageSrc(items[i].image)
          : '';
        const values = buildFieldValues(
          columnMapping,
          items[i],
          imageSrc,
          mapping.ctaDefaultLabel
        );

        if (i === 0) {
          injectBlockTranslations(this.blockObservable, values);
          continue;
        }

        const clone = this.vm.cloneBlockInstance(this.blockObservable);
        if (!clone) continue;
        injectBlockTranslations(clone, values);
        this.vm.addBlock(clone);
      }
    },
    formatDate(value) {
      return value ? new Date(value).toLocaleDateString() : '';
    },
  },
  template: `
    <modal-component ref="modalRef" class="content-feed-modal" :max-width="640" persistent>
      <div class="modal-content">
        <div class="row">
          <div class="col s12">
            <h5>{{ vm.t('content-feed-modal-title') }}</h5>
          </div>

          <div v-if="mappings.length > 1" class="col s12 input-field">
            <select v-model="activeMappingId" @change="fetchItems" class="browser-default">
              <option v-for="mapping in mappings" :key="mapping._id" :value="mapping._id">
                {{ mapping._id }}
              </option>
            </select>
          </div>

          <div v-if="isMultiColumn" class="col s12 content-feed-max-hint">
            {{ vm.t('content-feed-max-selectable', { count: maxSelectable }) }}
          </div>

          <div class="col s12" id="content-feed-list">
            <div v-if="isLoadingItems" class="content-feed-loading">
              {{ vm.t('content-feed-loading') }}
            </div>
            <div v-else-if="items.length === 0" class="content-feed-empty">
              {{ vm.t('content-feed-empty') }}
            </div>
            <template v-else>
              <label
                v-for="item in items"
                :key="item._key"
                class="content-feed-item"
                :class="{ 'content-feed-item--disabled': isSelectionDisabled(item._key) }"
              >
                <input
                  type="checkbox"
                  :value="item._key"
                  :disabled="isSelectionDisabled(item._key)"
                  v-model="selectedKeys"
                  class="content-feed-item-checkbox"
                />
                <span class="content-feed-item-title">{{ item.title }}</span>
                <span class="content-feed-item-date">{{ formatDate(item.pubDate) }}</span>
              </label>
            </template>
          </div>

          <div v-if="orderedSelectedItems.length > 1" class="col s12 content-feed-order">
            <div class="content-feed-order__label">{{ vm.t('content-feed-order-label') }}</div>
            <div
              v-for="(item, index) in orderedSelectedItems"
              :key="item._key"
              class="content-feed-order-item"
              :class="{ 'content-feed-order-item--drag-over': dragOverKey === item._key }"
              draggable="true"
              @dragstart.stop="onDragStart($event, item._key)"
              @dragenter.prevent.stop="onDragEnter(item._key)"
              @dragover.prevent.stop
              @drop.prevent.stop="onDrop(item._key)"
              @dragend.stop="onDragEnd"
            >
              <span class="lucide lucide-grip-vertical"></span>
              <span class="content-feed-order-item__position">{{ index + 1 }}</span>
              <span class="content-feed-order-item__title">{{ item.title }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button
          @click.prevent="closeModal"
          :disabled="isSubmitting"
          class="btn-flat waves-effect waves-light"
        >
          {{ vm.t('content-feed-cancel') }}
        </button>
        <button
          @click.prevent="handleSubmit"
          :disabled="!canSubmit"
          class="btn waves-effect waves-light"
        >
          <span v-if="isSubmitting">{{ vm.t('content-feed-adding') }}</span>
          <span v-else>{{ vm.t('content-feed-add-selection') }}</span>
        </button>
      </div>
    </modal-component>
  `,
});

module.exports = {
  ContentFeedModalComponent,
};
