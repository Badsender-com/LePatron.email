<template>
  <div
    class="drop-zone"
    :class="{
      'drop-zone--active': isDragActive,
      'drop-zone--highlighted': isHighlighted && !isDragActive,
    }"
  >
    <div class="drop-zone__header">
      <span class="drop-zone__icon"><slot name="icon" /></span>
      <span class="drop-zone__label">{{ label }}</span>
      <button
        v-if="!single || resolvedItems.length === 0"
        class="drop-zone__add-btn"
        :title="$t('deliverability.mapping.addManual')"
        @click.stop="startAdding"
      >
        <icon-plus :size="11" />
      </button>
    </div>

    <!-- Inline input for manual add -->
    <div v-if="isAddingManual" class="drop-zone__manual">
      <input
        ref="manualInput"
        v-model="manualValue"
        class="drop-zone__manual-input"
        :placeholder="$t('deliverability.mapping.addManualPlaceholder')"
        @keydown.enter.prevent="confirmManual"
        @keydown.esc="cancelManual"
      >
      <button
        class="drop-zone__manual-btn drop-zone__manual-btn--confirm"
        :disabled="!manualValue.trim()"
        @click="confirmManual"
      >
        <icon-check :size="12" />
      </button>
      <button
        class="drop-zone__manual-btn drop-zone__manual-btn--cancel"
        @click="cancelManual"
      >
        <icon-x :size="12" />
      </button>
    </div>

    <!-- Current items as badges -->
    <div class="drop-zone__items">
      <span
        v-for="item in resolvedItems"
        :key="item.id"
        class="drop-zone__badge"
      >
        {{ item.value }}
        <button
          class="drop-zone__remove"
          @click.stop="$emit('remove-item', item.id)"
        >
          <icon-x :size="10" />
        </button>
      </span>

      <!-- Draggable target (hidden when single mode already has a value) -->
      <draggable
        v-if="!single || resolvedItems.length === 0"
        :list="buffer"
        :group="{ name: dragGroup, pull: false, put: [dragGroup] }"
        class="drop-zone__target"
        :class="{
          'drop-zone__target--empty':
            resolvedItems.length === 0 && !isAddingManual,
        }"
        ghost-class="drop-zone__ghost"
        @change="onBufferChange"
        @start="isDragActive = true"
        @end="isDragActive = false"
      >
        <div
          v-if="resolvedItems.length === 0 && !isAddingManual"
          key="placeholder"
          class="drop-zone__placeholder"
        >
          {{ $t('deliverability.mapping.dropHere') }}
        </div>
      </draggable>
    </div>

    <!-- Fallback slot (e.g. a <select>) shown when no item is set in single mode -->
    <div
      v-if="
        single &&
          resolvedItems.length === 0 &&
          !isAddingManual &&
          $slots.fallback
      "
      class="drop-zone__fallback"
    >
      <slot name="fallback" />
    </div>
  </div>
</template>

<script>
import draggable from 'vuedraggable';

export default {
  name: 'MappingDropZone',
  components: { draggable },
  props: {
    label: { type: String, required: true },
    dragGroup: { type: String, required: true },
    resolvedItems: { type: Array, default: () => [] },
    single: { type: Boolean, default: false },
  },
  data() {
    return {
      buffer: [],
      isDragActive: false,
      isHighlighted: false,
      isAddingManual: false,
      manualValue: '',
    };
  },
  mounted() {
    this.$root.$on('mapping-drag-start', this.onGlobalDragStart);
    this.$root.$on('mapping-drag-end', this.onGlobalDragEnd);
  },
  beforeDestroy() {
    this.$root.$off('mapping-drag-start', this.onGlobalDragStart);
    this.$root.$off('mapping-drag-end', this.onGlobalDragEnd);
  },
  methods: {
    onBufferChange(evt) {
      if (evt.added) {
        const item = evt.added.element;
        if (item && item.id) {
          if (this.single && this.resolvedItems.length > 0) {
            this.$emit('remove-item', this.resolvedItems[0].id);
          }
          this.$emit('add-item', item.id);
        }
        this.$nextTick(() => {
          this.buffer = [];
        });
      }
    },
    startAdding() {
      this.isAddingManual = true;
      this.manualValue = '';
      this.$nextTick(() => {
        if (this.$refs.manualInput) {
          this.$refs.manualInput.focus();
        }
      });
    },
    confirmManual() {
      const value = this.manualValue.trim();
      if (!value) return;
      this.$emit('add-manual', value);
      this.isAddingManual = false;
      this.manualValue = '';
    },
    cancelManual() {
      this.isAddingManual = false;
      this.manualValue = '';
    },
    onGlobalDragStart(dragGroup) {
      this.isHighlighted = dragGroup === this.dragGroup;
    },
    onGlobalDragEnd() {
      this.isHighlighted = false;
    },
  },
};
</script>

<style scoped>
.drop-zone {
  border: 1px solid var(--gray-200);
  border-radius: var(--r-sm);
  background: var(--gray-50);
  padding: 8px 10px;
  transition: border-color var(--t-fast), background var(--t-fast);
}

.drop-zone--highlighted {
  border-color: #00acdc;
  border-style: dashed;
  background: rgba(0, 172, 220, 0.04);
}

.drop-zone--active {
  border-color: #00acdc;
  border-style: solid;
  background: rgba(0, 172, 220, 0.1);
}

.drop-zone__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.drop-zone__icon {
  color: var(--gray-400);
  display: flex;
}

.drop-zone__label {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gray-500);
}

.drop-zone__add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid var(--gray-300);
  border-radius: 4px;
  background: white;
  color: var(--gray-500);
  cursor: pointer;
  transition: all var(--t-fast);
  flex-shrink: 0;
}

.drop-zone__add-btn:hover {
  border-color: #00acdc;
  color: #00acdc;
  background: rgba(0, 172, 220, 0.06);
}

.drop-zone__manual {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}

.drop-zone__manual-input {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  font-size: 12px;
  font-family: inherit;
  border: 1px solid #00acdc;
  border-radius: var(--r-sm);
  outline: none;
  background: white;
  color: var(--gray-800);
}

.drop-zone__manual-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid;
  border-radius: var(--r-sm);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--t-fast);
}

.drop-zone__manual-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.drop-zone__manual-btn--confirm {
  background: #00acdc;
  border-color: #00acdc;
  color: white;
}

.drop-zone__manual-btn--confirm:not(:disabled):hover {
  background: #0891b2;
  border-color: #0891b2;
}

.drop-zone__manual-btn--cancel {
  background: white;
  border-color: var(--gray-300);
  color: var(--gray-500);
}

.drop-zone__manual-btn--cancel:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.drop-zone__items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 28px;
}

.drop-zone__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 12px;
  font-size: 12px;
  color: var(--gray-700);
}

.drop-zone__remove {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--gray-400);
  transition: color var(--t-fast);
}

.drop-zone__remove:hover {
  color: #dc2626;
}

.drop-zone__target {
  flex: 1;
  min-width: 60px;
  min-height: 28px;
  border-radius: var(--r-sm);
  transition: background var(--t-fast);
}

.drop-zone__target--empty {
  display: flex;
  align-items: center;
  width: 100%;
}

.drop-zone__placeholder {
  font-size: 11px;
  color: var(--gray-400);
  pointer-events: none;
  user-select: none;
}

.drop-zone__ghost {
  opacity: 0;
}

.drop-zone__fallback {
  margin-top: 6px;
}

.card-field__select--inline {
  width: 100%;
}
</style>
