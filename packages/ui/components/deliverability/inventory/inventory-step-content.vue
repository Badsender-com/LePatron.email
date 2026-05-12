<template>
  <div class="step-form">
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
        {{
          supportsDescription
            ? $t('deliverability.inventory.addHintWithDescription')
            : $t('deliverability.inventory.addHint')
        }}
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
              v-if="supportsDescription"
              v-model="editDescription"
              class="item-row__edit-input item-row__edit-input--description"
              :placeholder="
                $t('deliverability.inventory.editDescriptionPlaceholder')
              "
              @keydown.enter.prevent="confirmEdit"
              @keydown.esc="cancelEdit"
            >
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

export default {
  name: 'InventoryStepContent',
  props: {
    auditId: {
      type: String,
      required: true,
    },
    items: {
      type: Array,
      default: () => [],
    },
    category: {
      type: String,
      required: true,
    },
    placeholder: {
      type: String,
      default: 'Enter a value...',
    },
    showPrev: {
      type: Boolean,
      default: false,
    },
    showComplete: {
      type: Boolean,
      default: false,
    },
    supportsDescription: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      localItems: [],
      newItem: '',
      saving: false,
      editingIndex: null,
      editValue: '',
      editDescription: '',
    };
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
    addItem() {
      if (!this.newItem.trim()) return;

      const parsed = this.newItem
        .split(/[\n;]+/)
        .map((raw) => {
          const colonIndex = raw.indexOf(':');
          if (colonIndex !== -1) {
            return {
              value: raw.slice(0, colonIndex).trim(),
              description: raw.slice(colonIndex + 1).trim() || null,
            };
          }
          return { value: raw.trim(), description: null };
        })
        .filter((item) => item.value.length > 0);

      const existing = new Set(this.localItems.map((i) => i.value));
      parsed
        .filter((item) => !existing.has(item.value))
        .forEach((item) => this.localItems.push(item));

      this.newItem = '';
      this.autoSave();
    },
    removeItem(index) {
      this.localItems.splice(index, 1);
      this.autoSave();
    },
    startEdit(index) {
      this.editingIndex = index;
      this.editValue = this.localItems[index].value;
      this.editDescription = this.localItems[index].description || '';
      this.$nextTick(() => {
        const input = Array.isArray(this.$refs.editValueInput)
          ? this.$refs.editValueInput[0]
          : this.$refs.editValueInput;
        if (input) input.focus();
      });
    },
    confirmEdit() {
      if (!this.editValue.trim()) return;
      this.localItems[this.editingIndex].value = this.editValue.trim();
      this.localItems[this.editingIndex].description =
        this.editDescription.trim() || null;
      this.editingIndex = null;
      this.autoSave();
    },
    cancelEdit() {
      this.editingIndex = null;
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
        console.error('Error saving inventory:', error);
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

.items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-row {
  display: flex;
  align-items: center;
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

/* Edit mode */
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

/* Action buttons */
.item-row__actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--t-fast);
}

.item-row:hover .item-row__actions {
  opacity: 1;
}

.item-row__edit-actions {
  display: flex;
  gap: 4px;
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
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: all var(--t-fast);
}

.btn--primary {
  background: #00acdc;
  color: white;
}

.btn--primary:hover:not(:disabled) {
  background: #0891b2;
}

.btn--primary:disabled {
  background: var(--gray-200);
  color: var(--gray-400);
  cursor: not-allowed;
}

.btn--secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.btn--secondary:hover {
  background: var(--gray-200);
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
