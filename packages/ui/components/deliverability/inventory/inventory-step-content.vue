<template>
  <div class="step-form">
    <!-- Validation error banner -->
    <div v-if="validationError" class="validation-banner">
      <icon-alert-circle :size="14" />
      {{ validationError }}
    </div>
    <!-- URL normalization notice -->
    <div v-if="urlNormalized" class="validation-banner validation-banner--info">
      <icon-info :size="14" />
      {{ $t('deliverability.inventory.validation.urlNormalized') }}
    </div>

    <!-- Add new item -->
    <div class="add-item">
      <div class="add-item__input-wrap">
        <textarea
          v-model="newItem"
          rows="2"
          class="add-item__input"
          :placeholder="placeholder"
          @keydown.enter.exact.prevent="addItem"
        />
        <button
          class="add-item__btn"
          :disabled="!newItem.trim()"
          @click="addItem"
        >
          <icon-plus :size="20" />
        </button>
      </div>
      <p class="add-item__hint">
        {{ $t('deliverability.inventory.addHint') }}
      </p>
      <p v-if="showDkimSelectors" class="add-item__hint add-item__hint--dkim">
        {{ $t('deliverability.inventory.dkimSelectors.quickAddHint') }}
      </p>
      <p v-if="showIpType" class="add-item__hint add-item__hint--dkim">
        {{ $t('deliverability.inventory.ipType.quickAddHint') }}
      </p>
    </div>

    <!-- Items list -->
    <div v-if="localItems.length > 0" class="items-list">
      <div
        v-for="(item, index) in localItems"
        :key="item.id || index"
        class="item-row"
        :class="{ 'item-row--editing': editingIndex === index }"
      >
        <!-- Edit mode -->
        <template v-if="editingIndex === index">
          <div class="item-row__edit">
            <input
              ref="editValueInput"
              v-model="editValue"
              class="item-row__edit-input"
              :placeholder="$t('deliverability.inventory.editValuePlaceholder')"
              @keydown.enter.prevent="confirmEdit"
              @keydown.esc="cancelEdit"
            >
            <input
              v-model="editDescription"
              class="item-row__edit-input item-row__edit-input--description"
              :placeholder="
                $t('deliverability.inventory.editDescriptionPlaceholder')
              "
              @keydown.enter.prevent="confirmEdit"
              @keydown.esc="cancelEdit"
            >
            <!-- IP type (only for ip category) -->
            <div v-if="showIpType" class="ip-type">
              <label class="ip-type__label">
                {{ $t('deliverability.inventory.ipType.label') }}
              </label>
              <div class="ip-type__choices">
                <label class="ip-type__choice">
                  <input v-model="editIpType" type="radio" value="dedicated">
                  <span>{{
                    $t('deliverability.inventory.ipType.dedicated')
                  }}</span>
                </label>
                <label class="ip-type__choice">
                  <input v-model="editIpType" type="radio" value="shared">
                  <span>{{
                    $t('deliverability.inventory.ipType.shared')
                  }}</span>
                </label>
              </div>
            </div>
            <!-- DKIM selectors (only for display_from_domain) -->
            <div v-if="showDkimSelectors" class="dkim-selectors">
              <label class="dkim-selectors__label">
                {{ $t('deliverability.inventory.dkimSelectors.label') }}
              </label>
              <div class="dkim-selectors__tags">
                <span
                  v-for="(sel, si) in editDkimSelectors"
                  :key="si"
                  class="dkim-tag"
                >
                  {{ sel }}
                  <button
                    class="dkim-tag__remove"
                    @click="removeDkimSelector(si)"
                  >
                    <icon-x :size="10" />
                  </button>
                </span>
                <input
                  v-model="dkimSelectorInput"
                  class="dkim-selectors__input"
                  :placeholder="
                    $t('deliverability.inventory.dkimSelectors.placeholder')
                  "
                  @keydown.enter.prevent="addDkimSelector"
                  @keydown.188.prevent="addDkimSelector"
                >
              </div>
              <p class="dkim-selectors__hint">
                {{ $t('deliverability.inventory.dkimSelectors.hint') }}
              </p>
            </div>
          </div>
          <div class="item-row__edit-actions">
            <button
              class="item-row__action item-row__action--confirm"
              :disabled="!editValue.trim()"
              @click="confirmEdit"
            >
              <icon-check :size="16" />
            </button>
            <button
              class="item-row__action item-row__action--cancel"
              @click="cancelEdit"
            >
              <icon-x :size="16" />
            </button>
          </div>
        </template>

        <!-- Display mode -->
        <template v-else>
          <div class="item-row__content">
            <span class="item-row__value">{{ item.value }}</span>
            <span v-if="item.description" class="item-row__description">
              {{ item.description }}
            </span>
            <!-- IP type display -->
            <span
              v-if="showIpType && getIpType(item) === 'shared'"
              class="ip-badge ip-badge--shared"
            >
              {{ $t('deliverability.inventory.ipType.sharedBadge') }}
            </span>
            <!-- DKIM selectors display -->
            <div
              v-if="showDkimSelectors && getDkimSelectors(item).length > 0"
              class="dkim-display"
            >
              <span
                v-for="sel in getDkimSelectors(item)"
                :key="sel"
                class="dkim-badge"
              >
                DKIM: {{ sel }}
              </span>
            </div>
          </div>
          <div class="item-row__actions">
            <button class="item-row__action" @click="startEdit(index)">
              <icon-pencil :size="15" />
            </button>
            <button
              class="item-row__action item-row__action--delete"
              @click="removeItem(index)"
            >
              <icon-trash2 :size="15" />
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <icon-inbox :size="40" />
      <p>{{ $t('deliverability.inventory.noItems') }}</p>
    </div>

    <!-- Actions -->
    <div class="step-actions">
      <button v-if="showPrev" class="btn btn--secondary" @click="$emit('prev')">
        <icon-chevron-left :size="18" />
        {{ $t('deliverability.inventory.previous') }}
      </button>
      <div class="step-actions__spacer" />
      <span v-if="saving" class="saving-indicator">
        <icon-refresh-cw :size="14" class="saving-indicator__icon" />
        {{ $t('deliverability.inventory.saving') }}
      </span>
      <!-- Mark complete toggle -->
      <button
        class="btn"
        :class="isCompleted ? 'btn--complete-active' : 'btn--complete'"
        @click="toggleComplete"
      >
        <icon-check v-if="isCompleted" :size="16" />
        <icon-circle v-else :size="16" />
        {{
          isCompleted
            ? $t('deliverability.inventory.markIncomplete')
            : $t('deliverability.inventory.markComplete')
        }}
      </button>
      <button
        v-if="showComplete"
        class="btn btn--primary"
        @click="$emit('complete')"
      >
        {{ $t('deliverability.inventory.complete') }}
      </button>
      <button v-else class="btn btn--primary" @click="$emit('next')">
        {{ $t('deliverability.inventory.continue') }}
        <icon-chevron-right :size="18" />
      </button>
    </div>
  </div>
</template>

<script>
import { mapActions } from 'vuex';
import { DELIVERABILITY, BULK_UPSERT_INVENTORY } from '~/store/deliverability';

// Domain-like categories that need URL normalization
const DOMAIN_CATEGORIES = [
  'display_from_domain',
  'mail_from_domain',
  'tracking_domain',
  'hosting_domain',
  'link_destination_domain',
];

// IPv4 and IPv6 regex
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
const IPV6_RE = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?\d)?\d)\.){3}(25[0-5]|(2[0-4]|1?\d)?\d)|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?\d)?\d)\.){3}(25[0-5]|(2[0-4]|1?\d)?\d))(\/\d{1,3})?$/;

function isValidIp(value) {
  return IPV4_RE.test(value) || IPV6_RE.test(value);
}

function isValidEmail(value) {
  return value.includes('@');
}

function normalizeDomain(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

export default {
  name: 'InventoryStepContent',
  props: {
    auditId: { type: String, required: true },
    items: { type: Array, default: () => [] },
    category: { type: String, required: true },
    placeholder: { type: String, default: 'Enter a value...' },
    showPrev: { type: Boolean, default: false },
    showComplete: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false },
  },
  data() {
    return {
      localItems: [],
      newItem: '',
      saving: false,
      editingIndex: null,
      editValue: '',
      editDescription: '',
      editDkimSelectors: [],
      dkimSelectorInput: '',
      editIpType: 'dedicated',
      validationError: null,
      urlNormalized: false,
    };
  },
  computed: {
    showDkimSelectors() {
      return this.category.toLowerCase() === 'display_from_domain';
    },
    showIpType() {
      return this.category.toLowerCase() === 'ip';
    },
    categoryLower() {
      return this.category.toLowerCase();
    },
  },
  watch: {
    items: {
      immediate: true,
      handler(newItems) {
        this.localItems = newItems.map((item) => ({ ...item }));
      },
    },
  },
  methods: {
    ...mapActions(DELIVERABILITY, {
      bulkUpsert: BULK_UPSERT_INVENTORY,
    }),
    getDkimSelectors(item) {
      return item.metadata && Array.isArray(item.metadata.dkimSelectors)
        ? item.metadata.dkimSelectors
        : [];
    },
    getIpType(item) {
      return item.metadata && item.metadata.ipType === 'shared'
        ? 'shared'
        : 'dedicated';
    },
    normalizeAndValidate(raw) {
      let value = raw.trim();
      let wasNormalized = false;

      if (DOMAIN_CATEGORIES.includes(this.categoryLower)) {
        const normalized = normalizeDomain(value);
        if (normalized !== value.toLowerCase()) wasNormalized = true;
        value = normalized;
      }

      if (!value)
        return {
          value: null,
          error: this.$t('deliverability.inventory.validation.emptyValue'),
          wasNormalized,
        };

      if (this.categoryLower === 'ip') {
        if (!isValidIp(value)) {
          return {
            value,
            error: this.$t('deliverability.inventory.validation.invalidIp'),
            wasNormalized,
          };
        }
      }

      if (
        this.categoryLower === 'display_from_address' ||
        this.categoryLower === 'reply_to'
      ) {
        if (!isValidEmail(value)) {
          return {
            value,
            error: this.$t('deliverability.inventory.validation.invalidEmail'),
            wasNormalized,
          };
        }
      }

      return { value, error: null, wasNormalized };
    },
    addItem() {
      if (!this.newItem.trim()) return;
      this.validationError = null;
      this.urlNormalized = false;

      const raws = this.newItem
        .split(/[\n;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const toAdd = [];
      let firstError = null;
      let anyNormalized = false;

      for (const raw of raws) {
        const colonIndex = raw.indexOf(':');
        let rawValue = raw;
        let description = null;
        let itemDkimSelectors = [];
        let itemIpType = null;

        if (this.showIpType) {
          // ip: "1.2.3.4 shared" / "1.2.3.4 s" / "1.2.3.4 dedicated" / "1.2.3.4"
          const m = raw.match(
            /^(.+?)\s+(shared|dedicated|s|d|mutualis[eé]e?|d[eé]di[eé]e?)$/i
          );
          if (m) {
            rawValue = m[1].trim();
            const kw = m[2].toLowerCase();
            itemIpType =
              kw.startsWith('s') || kw.startsWith('m') ? 'shared' : 'dedicated';
          }
        } else if (this.showDkimSelectors && colonIndex !== -1) {
          // display_from_domain: domain.com:selector1,selector2
          rawValue = raw.slice(0, colonIndex).trim();
          const selectorPart = raw.slice(colonIndex + 1).trim();
          itemDkimSelectors = selectorPart
            ? selectorPart
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [];
        } else if (
          colonIndex !== -1 &&
          this.categoryLower !== 'ip' &&
          this.categoryLower !== 'display_from_address' &&
          this.categoryLower !== 'reply_to'
        ) {
          rawValue = raw.slice(0, colonIndex).trim();
          description = raw.slice(colonIndex + 1).trim() || null;
        }

        const { value, error, wasNormalized } = this.normalizeAndValidate(
          rawValue
        );
        if (wasNormalized) anyNormalized = true;
        if (error) {
          firstError = error;
          continue;
        }

        const existing = new Set(this.localItems.map((i) => i.value));
        if (value && !existing.has(value)) {
          let metadata = null;
          if (itemDkimSelectors.length > 0) {
            metadata = { dkimSelectors: itemDkimSelectors };
          } else if (itemIpType === 'shared') {
            metadata = { ipType: 'shared' };
          }
          toAdd.push({ value, description, metadata });
        }
      }

      if (firstError) this.validationError = firstError;
      if (anyNormalized) this.urlNormalized = true;
      if (toAdd.length > 0) {
        this.localItems.push(...toAdd);
        this.newItem = '';
        this.autoSave();
      } else if (!firstError) {
        this.newItem = '';
      }
      // Clear notices after delay
      setTimeout(() => {
        this.validationError = null;
        this.urlNormalized = false;
      }, 4000);
    },
    removeItem(index) {
      this.localItems.splice(index, 1);
      this.autoSave();
    },
    startEdit(index) {
      this.editingIndex = index;
      this.editValue = this.localItems[index].value;
      this.editDescription = this.localItems[index].description || '';
      this.editDkimSelectors = this.getDkimSelectors(
        this.localItems[index]
      ).slice();
      this.dkimSelectorInput = '';
      this.editIpType = this.getIpType(this.localItems[index]);
      this.$nextTick(() => {
        const input = Array.isArray(this.$refs.editValueInput)
          ? this.$refs.editValueInput[0]
          : this.$refs.editValueInput;
        if (input) input.focus();
      });
    },
    confirmEdit() {
      if (!this.editValue.trim()) return;
      const { value, error } = this.normalizeAndValidate(this.editValue);
      if (error) {
        this.validationError = error;
        return;
      }
      const item = this.localItems[this.editingIndex];
      item.value = value;
      item.description = this.editDescription.trim() || null;
      if (this.showDkimSelectors) {
        item.metadata =
          this.editDkimSelectors.length > 0
            ? { dkimSelectors: this.editDkimSelectors }
            : null;
      } else if (this.showIpType) {
        item.metadata =
          this.editIpType === 'shared' ? { ipType: 'shared' } : null;
      }
      this.editingIndex = null;
      this.autoSave();
    },
    cancelEdit() {
      this.editingIndex = null;
    },
    addDkimSelector() {
      const val = this.dkimSelectorInput.trim().replace(/,$/, '');
      if (val && !this.editDkimSelectors.includes(val)) {
        this.editDkimSelectors.push(val);
      }
      this.dkimSelectorInput = '';
    },
    removeDkimSelector(index) {
      this.editDkimSelectors.splice(index, 1);
    },
    toggleComplete() {
      this.$emit('toggle-complete', !this.isCompleted);
    },
    async autoSave() {
      this.saving = true;
      try {
        await this.bulkUpsert({
          auditId: this.auditId,
          category: this.category,
          items: this.localItems,
          updateProgress: true,
        });
        this.$emit('saved');
      } catch (error) {
        this.$emit('error', error);
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.step-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.validation-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: var(--r-sm);
  font-size: 13px;
}

.validation-banner--info {
  background: #fef3c7;
  color: #d97706;
}

.add-item__input-wrap {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.add-item__input {
  flex: 1;
  padding: 12px 16px;
  font-size: 15px;
  font-family: inherit;
  line-height: 1.5;
  border: 1px solid var(--gray-200);
  border-radius: var(--r-sm);
  background: var(--white);
  color: var(--gray-900);
  resize: vertical;
  min-height: 52px;
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
}

.add-item__input:focus {
  outline: none;
  border-color: #00acdc;
  box-shadow: 0 0 0 3px rgba(0, 172, 220, 0.1);
}

.add-item__input::placeholder {
  color: var(--gray-400);
}

.add-item__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: #00acdc;
  color: white;
  border: none;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background var(--t-fast);
}

.add-item__btn:hover:not(:disabled) {
  background: #0891b2;
}

.add-item__btn:disabled {
  background: var(--gray-200);
  color: var(--gray-400);
  cursor: not-allowed;
}

.add-item__hint {
  margin: 6px 0 0 0;
  font-size: 12px;
  color: var(--gray-400);
}

.add-item__hint--dkim {
  font-family: monospace;
  color: #0369a1;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: var(--gray-50);
  border-radius: var(--r-sm);
  transition: background var(--t-fast);
}

.item-row:hover {
  background: var(--gray-100);
}

.item-row--editing {
  background: var(--white);
  border: 1px solid #00acdc;
  box-shadow: 0 0 0 3px rgba(0, 172, 220, 0.1);
}

.item-row--editing:hover {
  background: var(--white);
}

.item-row__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-row__value {
  font-size: 15px;
  font-weight: 500;
  color: var(--gray-900);
}

.item-row__description {
  font-size: 13px;
  color: var(--gray-500);
}

.item-row__edit {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.item-row__edit-input {
  width: 100%;
  padding: 6px 10px;
  font-size: 14px;
  font-family: inherit;
  border: 1px solid var(--gray-200);
  border-radius: var(--r-sm);
  background: var(--white);
  color: var(--gray-900);
  outline: none;
  transition: border-color var(--t-fast);
}

.item-row__edit-input:focus {
  border-color: #00acdc;
}

.item-row__edit-input--description {
  font-size: 13px;
  color: var(--gray-600);
}

.item-row__actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--t-fast);
  flex-shrink: 0;
}

.item-row:hover .item-row__actions {
  opacity: 1;
}

.item-row__edit-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.item-row__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: transparent;
  color: var(--gray-400);
  border: none;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: all var(--t-fast);
}

.item-row__action:hover {
  background: var(--gray-200);
  color: var(--gray-700);
}
.item-row__action--delete:hover {
  background: #fee2e2;
  color: #dc2626;
}
.item-row__action--confirm:not(:disabled):hover {
  background: #dcfce7;
  color: #16a34a;
}
.item-row__action--confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.item-row__action--cancel:hover {
  background: #fee2e2;
  color: #dc2626;
}

/* DKIM selectors */
.dkim-selectors {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dkim-selectors__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gray-500);
}

.dkim-selectors__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid var(--gray-200);
  border-radius: var(--r-sm);
  background: var(--white);
  min-height: 34px;
}

.dkim-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  background: #e0f2fe;
  border: 1px solid #7dd3fc;
  color: #0369a1;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.dkim-tag__remove {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: #0369a1;
  opacity: 0.6;
}

.dkim-tag__remove:hover {
  opacity: 1;
}

.dkim-selectors__input {
  border: none;
  outline: none;
  font-size: 12px;
  font-family: inherit;
  color: var(--gray-800);
  flex: 1;
  min-width: 80px;
  background: transparent;
}

.dkim-selectors__hint {
  font-size: 11px;
  color: var(--gray-400);
  margin: 0;
}

.dkim-display {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.dkim-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  background: #e0f2fe;
  border: 1px solid #7dd3fc;
  color: #0369a1;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
}

.ip-type {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.ip-type__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gray-500);
}

.ip-type__choices {
  display: flex;
  gap: 12px;
}

.ip-type__choice {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--gray-700);
  cursor: pointer;
}

.ip-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  margin-top: 2px;
  width: fit-content;
}

.ip-badge--shared {
  background: #fef3c7;
  border: 1px solid #fde68a;
  color: #d97706;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: var(--gray-400);
}

.empty-state p {
  margin: 12px 0 0 0;
  font-size: 14px;
}

.step-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid var(--gray-100);
  margin-top: 8px;
  flex-wrap: wrap;
}

.step-actions__spacer {
  flex: 1;
}

.saving-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--gray-400);
}

.saving-indicator__icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: all var(--t-fast);
}

.btn--primary {
  background: #00acdc;
  color: white;
  border-color: #00acdc;
}
.btn--primary:hover:not(:disabled) {
  background: #0891b2;
  border-color: #0891b2;
}

.btn--secondary {
  background: var(--gray-100);
  color: var(--gray-700);
  border-color: var(--gray-200);
}
.btn--secondary:hover {
  background: var(--gray-200);
}

.btn--complete {
  background: white;
  color: var(--gray-500);
  border-color: var(--gray-200);
}
.btn--complete:hover {
  border-color: #10b981;
  color: #10b981;
}

.btn--complete-active {
  background: #dcfce7;
  color: #16a34a;
  border-color: #bbf7d0;
}
.btn--complete-active:hover {
  background: #fee2e2;
  color: #dc2626;
  border-color: #fecaca;
}

@media (max-width: 640px) {
  .add-item__input-wrap {
    flex-direction: column;
  }
  .add-item__btn {
    width: 100%;
  }
  .step-actions {
    flex-direction: column;
  }
  .step-actions__spacer {
    display: none;
  }
  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
