<template>
  <div class="drop-zone" :class="{ 'drop-zone--active': isDragActive }">
    <div class="drop-zone__header">
      <span class="drop-zone__icon"><slot name="icon" /></span>
      <span class="drop-zone__label">{{ label }}</span>
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

      <!-- Draggable target zone (invisible buffer) -->
      <draggable
        :list="buffer"
        :group="{ name: dragGroup, pull: false, put: true }"
        class="drop-zone__target"
        :class="{ 'drop-zone__target--empty': resolvedItems.length === 0 }"
        ghost-class="drop-zone__ghost"
        @change="onBufferChange"
        @start="isDragActive = true"
        @end="isDragActive = false"
      >
        <div
          v-if="resolvedItems.length === 0"
          key="placeholder"
          class="drop-zone__placeholder"
        >
          {{ $t('deliverability.mapping.dropHere') }}
        </div>
      </draggable>
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
  },
  data() {
    return {
      buffer: [],
      isDragActive: false,
    };
  },
  methods: {
    onBufferChange(evt) {
      if (evt.added) {
        const item = evt.added.element;
        if (item && item.id) {
          this.$emit('add-item', item.id);
        }
        this.$nextTick(() => {
          this.buffer = [];
        });
      }
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

.drop-zone--active {
  border-color: #00acdc;
  background: rgba(0, 172, 220, 0.04);
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
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gray-500);
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
</style>
