<template>
  <div class="mapping-card" :class="`mapping-card--${statusClass}`">
    <!-- Header -->
    <div class="mapping-card__header">
      <span class="drag-handle">
        <icon-grip-vertical :size="16" />
      </span>

      <!-- Name (editable) -->
      <div class="mapping-card__name" @dblclick="startEditName">
        <template v-if="editingName">
          <input
            ref="nameInput"
            v-model="nameValue"
            class="mapping-card__name-input"
            @keydown.enter.prevent="confirmName"
            @keydown.esc="cancelName"
            @blur="confirmName"
          >
        </template>
        <template v-else>
          <span class="mapping-card__name-text">{{ displayTitle }}</span>
        </template>
      </div>

      <!-- Scores -->
      <div class="mapping-card__scores">
        <div
          class="mapping-card__score-item"
          :title="$t('deliverability.mapping.card.qualityScore')"
        >
          <mapping-rating-stars
            :value="entry.qualityScore"
            @input="update('qualityScore', $event)"
          />
        </div>
        <div class="mapping-card__score-sep" />
        <div
          class="mapping-card__score-item"
          :title="$t('deliverability.mapping.card.strategicScore')"
        >
          <mapping-rating-stars
            :value="entry.strategicScore"
            @input="update('strategicScore', $event)"
          />
        </div>
      </div>

      <!-- Status -->
      <select
        class="mapping-card__status"
        :class="`mapping-card__status--${statusClass}`"
        :value="entry.status"
        @change="update('status', $event.target.value)"
      >
        <option value="EN_DISCUSSION">
          {{ $t('deliverability.mapping.status.en_discussion') }}
        </option>
        <option value="CONFIRMED">
          {{ $t('deliverability.mapping.status.confirmed') }}
        </option>
        <option value="REJECTED">
          {{ $t('deliverability.mapping.status.rejected') }}
        </option>
      </select>

      <!-- Actions -->
      <button
        class="mapping-card__action"
        :title="$t('deliverability.mapping.card.toggleExpand')"
        @click="expanded = !expanded"
      >
        <icon-chevron-down
          :size="16"
          :style="{
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s',
          }"
        />
      </button>
      <button
        class="mapping-card__action mapping-card__action--delete"
        :title="$t('deliverability.mapping.card.delete')"
        @click="$emit('delete')"
      >
        <icon-trash2 :size="15" />
      </button>
    </div>

    <!-- Body -->
    <div v-if="expanded" class="mapping-card__body">
      <!-- Platform (drop zone + select fallback) -->
      <mapping-drop-zone
        :label="$t('deliverability.mapping.fields.platform')"
        drag-group="inv-platform"
        :resolved-items="
          entry.platformId && inventoryMap[entry.platformId]
            ? [inventoryMap[entry.platformId]]
            : []
        "
        :single="true"
        @add-item="update('platformId', $event)"
        @remove-item="update('platformId', null)"
      >
        <template #icon>
          <icon-server :size="13" />
        </template>
        <template #fallback>
          <select
            class="card-field__select card-field__select--inline"
            :value="entry.platformId || ''"
            @change="update('platformId', $event.target.value || null)"
          >
            <option value="">
              — {{ $t('deliverability.mapping.fields.selectPlatform') }} —
            </option>
            <option
              v-for="item in platformItems"
              :key="item.id"
              :value="item.id"
            >
              {{ item.value }}
            </option>
          </select>
        </template>
      </mapping-drop-zone>

      <!-- Usage (drop zone + select fallback) -->
      <mapping-drop-zone
        :label="$t('deliverability.mapping.fields.usage')"
        drag-group="inv-usage"
        :resolved-items="
          entry.usageId && inventoryMap[entry.usageId]
            ? [inventoryMap[entry.usageId]]
            : []
        "
        :single="true"
        @add-item="update('usageId', $event)"
        @remove-item="update('usageId', null)"
      >
        <template #icon>
          <icon-tag :size="13" />
        </template>
        <template #fallback>
          <select
            class="card-field__select card-field__select--inline"
            :value="entry.usageId || ''"
            @change="update('usageId', $event.target.value || null)"
          >
            <option value="">
              — {{ $t('deliverability.mapping.fields.selectUsage') }} —
            </option>
            <option v-for="item in usageItems" :key="item.id" :value="item.id">
              {{ item.value
              }}<template v-if="item.description">
                · {{ item.description }}
              </template>
            </option>
          </select>
        </template>
      </mapping-drop-zone>

      <!-- Array drop zones -->
      <div class="card-fields-grid">
        <mapping-drop-zone
          v-for="field in arrayFields"
          :key="field.key"
          :label="$t(`deliverability.mapping.fields.${field.labelKey}`)"
          :drag-group="`inv-${field.category}`"
          :resolved-items="resolveItems(entry[field.key])"
          @add-item="addItem(field.key, $event)"
          @remove-item="removeItem(field.key, $event)"
        >
          <template #icon>
            <component :is="field.icon" :size="13" />
          </template>
        </mapping-drop-zone>
      </div>

      <!-- Shared IPs checkbox (shown under IPs) -->
      <label class="card-field__checkbox">
        <input
          type="checkbox"
          :checked="entry.usesSharedIps"
          @change="update('usesSharedIps', $event.target.checked)"
        >
        {{ $t('deliverability.mapping.fields.sharedIps') }}
      </label>

      <!-- Comments -->
      <div class="card-field">
        <label class="card-field__label">
          <icon-file-text :size="13" />
          {{ $t('deliverability.mapping.fields.comments') }}
        </label>
        <textarea
          class="card-field__textarea"
          rows="2"
          :placeholder="$t('deliverability.mapping.fields.commentsPlaceholder')"
          :value="entry.comments || ''"
          @input="debouncedCommentUpdate"
        />
      </div>
    </div>
  </div>
</template>

<script>
import MappingRatingStars from './mapping-rating-stars.vue';
import MappingDropZone from './mapping-drop-zone.vue';

const ARRAY_FIELDS = [
  {
    key: 'fromDomainIds',
    category: 'display_from_domain',
    icon: 'icon-globe',
    labelKey: 'fromDomains',
  },
  { key: 'ipIds', category: 'ip', icon: 'icon-network', labelKey: 'ips' },
  {
    key: 'mailFromIds',
    category: 'mail_from_domain',
    icon: 'icon-mail',
    labelKey: 'mailFrom',
  },
  {
    key: 'replyToIds',
    category: 'reply_to',
    icon: 'icon-mail',
    labelKey: 'replyTo',
  },
  {
    key: 'trackingDomainIds',
    category: 'tracking_domain',
    icon: 'icon-link',
    labelKey: 'trackingDomains',
  },
  {
    key: 'hostingDomainIds',
    category: 'hosting_domain',
    icon: 'icon-image',
    labelKey: 'hostingDomains',
  },
  {
    key: 'linkDestinationDomainIds',
    category: 'link_destination_domain',
    icon: 'icon-external-link',
    labelKey: 'linkDestinationDomains',
  },
];

export default {
  name: 'MappingCard',
  components: { MappingRatingStars, MappingDropZone },
  props: {
    entry: { type: Object, required: true },
    inventoryMap: { type: Object, default: () => ({}) },
    inventoryItems: { type: Object, default: () => ({}) },
    isNew: { type: Boolean, default: false },
  },
  data() {
    return {
      expanded: this.isNew,
      editingName: false,
      nameValue: '',
      arrayFields: ARRAY_FIELDS,
      commentTimer: null,
    };
  },
  computed: {
    displayTitle() {
      if (this.entry.customName) return this.entry.customName;
      const parts = [];
      const platform = this.inventoryMap[this.entry.platformId];
      const usage = this.inventoryMap[this.entry.usageId];
      const firstDomain =
        this.entry.fromDomainIds && this.entry.fromDomainIds[0]
          ? this.inventoryMap[this.entry.fromDomainIds[0]]
          : null;
      if (platform) parts.push(platform.value);
      if (usage) parts.push(usage.value);
      if (firstDomain) parts.push(firstDomain.value);
      return parts.length > 0
        ? parts.join(' · ')
        : this.$t('deliverability.mapping.card.untitled');
    },
    statusClass() {
      const map = {
        EN_DISCUSSION: 'discussion',
        CONFIRMED: 'confirmed',
        REJECTED: 'rejected',
      };
      return map[this.entry.status] || 'discussion';
    },
    platformItems() {
      return this.inventoryItems.platform || [];
    },
    usageItems() {
      return this.inventoryItems.usage || [];
    },
  },
  methods: {
    update(field, value) {
      this.$emit('update', { field, value });
    },
    resolveItems(ids) {
      if (!ids || !ids.length) return [];
      return ids.map((id) => this.inventoryMap[id]).filter(Boolean);
    },
    addItem(field, itemId) {
      const current = this.entry[field] || [];
      if (!current.includes(itemId)) {
        this.update(field, [...current, itemId]);
      }
    },
    removeItem(field, itemId) {
      const current = this.entry[field] || [];
      this.update(
        field,
        current.filter((id) => id !== itemId)
      );
    },
    startEditName() {
      this.nameValue = this.entry.customName || '';
      this.editingName = true;
      this.$nextTick(() => {
        const input = Array.isArray(this.$refs.nameInput)
          ? this.$refs.nameInput[0]
          : this.$refs.nameInput;
        if (input) input.focus();
      });
    },
    confirmName() {
      this.update('customName', this.nameValue.trim() || null);
      this.editingName = false;
    },
    cancelName() {
      this.editingName = false;
    },
    debouncedCommentUpdate(evt) {
      clearTimeout(this.commentTimer);
      const value = evt.target.value;
      this.commentTimer = setTimeout(() => {
        this.update('comments', value || null);
      }, 600);
    },
  },
};
</script>

<style scoped>
.mapping-card {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--r-md);
  overflow: hidden;
  transition: box-shadow var(--t-fast);
}

.mapping-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.mapping-card--confirmed {
  border-left: 3px solid #22c55e;
}

.mapping-card--rejected {
  border-left: 3px solid #ef4444;
  opacity: 0.7;
}

.mapping-card--discussion {
  border-left: 3px solid var(--gray-300);
}

/* Header */
.mapping-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-100);
}

.drag-handle {
  display: flex;
  align-items: center;
  color: var(--gray-300);
  cursor: grab;
  flex-shrink: 0;
}

.drag-handle:active {
  cursor: grabbing;
}

.mapping-card__name {
  flex: 1;
  min-width: 0;
}

.mapping-card__name-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-800);
  cursor: text;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.mapping-card__name-input {
  width: 100%;
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-800);
  border: 1px solid #00acdc;
  border-radius: var(--r-sm);
  padding: 2px 6px;
  outline: none;
  background: white;
}

.mapping-card__scores {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.mapping-card__score-sep {
  width: 1px;
  height: 16px;
  background: var(--gray-200);
}

.mapping-card__status {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 6px;
  border-radius: 10px;
  border: 1px solid;
  cursor: pointer;
  appearance: none;
  flex-shrink: 0;
}

.mapping-card__status--discussion {
  background: var(--gray-100);
  color: var(--gray-600);
  border-color: var(--gray-200);
}

.mapping-card__status--confirmed {
  background: #dcfce7;
  color: #16a34a;
  border-color: #bbf7d0;
}

.mapping-card__status--rejected {
  background: #fee2e2;
  color: #dc2626;
  border-color: #fecaca;
}

.mapping-card__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: none;
  border: none;
  border-radius: var(--r-sm);
  cursor: pointer;
  color: var(--gray-400);
  transition: all var(--t-fast);
  flex-shrink: 0;
}

.mapping-card__action:hover {
  background: var(--gray-100);
  color: var(--gray-700);
}

.mapping-card__action--delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

/* Body */
.mapping-card__body {
  padding: 14px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-field__label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gray-500);
}

.card-field__select {
  padding: 6px 10px;
  font-size: 13px;
  font-family: inherit;
  border: 1px solid var(--gray-200);
  border-radius: var(--r-sm);
  background: white;
  color: var(--gray-800);
  cursor: pointer;
}

.card-field__select:focus {
  outline: none;
  border-color: #00acdc;
}

.card-field__textarea {
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  border: 1px solid var(--gray-200);
  border-radius: var(--r-sm);
  background: white;
  color: var(--gray-800);
  resize: vertical;
  min-height: 52px;
  line-height: 1.5;
}

.card-field__textarea:focus {
  outline: none;
  border-color: #00acdc;
}

.card-field__checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--gray-600);
  cursor: pointer;
}

.card-fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

@media (max-width: 900px) {
  .card-fields-grid {
    grid-template-columns: 1fr;
  }
}
</style>
