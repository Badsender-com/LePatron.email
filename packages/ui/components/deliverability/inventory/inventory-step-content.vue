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
      >
        <div class="item-row__content">
          <span class="item-row__value">{{ item.value }}</span>
          <span v-if="item.description" class="item-row__description">
            {{ item.description }}
          </span>
        </div>
        <button class="item-row__delete" @click="removeItem(index)">
          <icon-trash2 :size="16" />
        </button>
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
      <button
        v-if="showComplete"
        class="btn btn--primary"
        :disabled="saving"
        @click="handleComplete"
      >
        <span v-if="saving">{{ $t('deliverability.inventory.saving') }}</span>
        <span v-else>{{ $t('deliverability.inventory.complete') }}</span>
      </button>
      <button
        v-else
        class="btn btn--primary"
        :disabled="saving"
        @click="handleSaveAndNext"
      >
        <span v-if="saving">{{ $t('deliverability.inventory.saving') }}</span>
        <template v-else>
          {{ $t('deliverability.inventory.saveAndContinue') }}
          <icon-chevron-right :size="18" />
        </template>
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
        .split(/[\n,]+/)
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
    },
    removeItem(index) {
      this.localItems.splice(index, 1);
    },
    async saveItems() {
      this.saving = true;
      try {
        await this.bulkUpsert({
          auditId: this.auditId,
          category: this.category,
          items: this.localItems,
        });
        this.$emit('save');
        return true;
      } catch (error) {
        console.error('Error saving inventory:', error);
        this.$emit('error', error);
        return false;
      } finally {
        this.saving = false;
      }
    },
    async handleSaveAndNext() {
      const success = await this.saveItems();
      if (success) {
        this.$emit('next');
      }
    },
    async handleComplete() {
      const success = await this.saveItems();
      if (success) {
        this.$emit('complete');
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
  padding: 14px 16px;
  background: var(--gray-50);
  border-radius: var(--r-sm);
  transition: background var(--t-fast);
}

.item-row:hover {
  background: var(--gray-100);
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
  color: var(--gray-600);
}

.item-row__delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  color: var(--gray-400);
  border: none;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: all var(--t-fast);
}

.item-row__delete:hover {
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
