<template>
  <div class="mapping-group">
    <!-- Group header -->
    <div class="mapping-group__header">
      <button
        class="mapping-group__collapse"
        @click="localCollapsed = !localCollapsed"
      >
        <icon-chevron-right
          :size="16"
          :style="{
            transform: localCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
            transition: 'transform 0.2s',
          }"
        />
      </button>

      <template v-if="editingName">
        <input
          ref="nameInput"
          v-model="nameValue"
          class="mapping-group__name-input"
          @keydown.enter.prevent="confirmName"
          @keydown.esc="cancelName"
          @blur="confirmName"
        >
      </template>
      <span v-else class="mapping-group__name" @dblclick="startEditName">
        {{ group.name }}
      </span>

      <span class="mapping-group__count">{{ entries.length }}</span>

      <div class="mapping-group__actions">
        <button
          class="mapping-group__btn"
          :title="$t('deliverability.mapping.group.rename')"
          @click="startEditName"
        >
          <icon-pencil :size="13" />
        </button>
        <button
          class="mapping-group__btn mapping-group__btn--delete"
          :title="$t('deliverability.mapping.group.delete')"
          @click="$emit('delete')"
        >
          <icon-trash2 :size="13" />
        </button>
      </div>
    </div>

    <!-- Group entries -->
    <div v-if="!localCollapsed" class="mapping-group__body">
      <draggable
        :list="entries"
        :group="{ name: 'mapping-cards' }"
        handle=".drag-handle"
        ghost-class="card-ghost"
        :animation="150"
        @change="(evt) => $emit('entries-changed', { groupId: group.id, evt })"
      >
        <mapping-card
          v-for="entry in entries"
          :key="entry.id"
          :entry="entry"
          :inventory-map="inventoryMap"
          :inventory-items="inventoryItems"
          @update="
            (payload) =>
              $emit('update-entry', { ...payload, entryId: entry.id })
          "
          @delete="$emit('delete-entry', entry.id)"
        />
      </draggable>

      <div v-if="entries.length === 0" class="mapping-group__empty">
        {{ $t('deliverability.mapping.group.empty') }}
      </div>
    </div>
  </div>
</template>

<script>
import draggable from 'vuedraggable';
import MappingCard from './mapping-card.vue';

export default {
  name: 'MappingGroup',
  components: { draggable, MappingCard },
  props: {
    group: { type: Object, required: true },
    entries: { type: Array, default: () => [] },
    inventoryMap: { type: Object, default: () => ({}) },
    inventoryItems: { type: Object, default: () => ({}) },
  },
  data() {
    return {
      localCollapsed: this.group.isCollapsed,
      editingName: false,
      nameValue: '',
    };
  },
  watch: {
    localCollapsed(val) {
      this.$emit('update-group', {
        groupId: this.group.id,
        field: 'isCollapsed',
        value: val,
      });
    },
  },
  methods: {
    startEditName() {
      this.nameValue = this.group.name;
      this.editingName = true;
      this.$nextTick(() => {
        const input = Array.isArray(this.$refs.nameInput)
          ? this.$refs.nameInput[0]
          : this.$refs.nameInput;
        if (input) input.focus();
      });
    },
    confirmName() {
      const name = this.nameValue.trim();
      if (name && name !== this.group.name) {
        this.$emit('update-group', {
          groupId: this.group.id,
          field: 'name',
          value: name,
        });
      }
      this.editingName = false;
    },
    cancelName() {
      this.editingName = false;
    },
  },
};
</script>

<style scoped>
.mapping-group {
  border: 1px solid var(--gray-200);
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--white);
}

.mapping-group__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-100);
  cursor: default;
}

.mapping-group__collapse {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--gray-500);
  flex-shrink: 0;
}

.mapping-group__name {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  color: var(--gray-800);
  cursor: text;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mapping-group__name-input {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  color: var(--gray-800);
  border: 1px solid #00acdc;
  border-radius: var(--r-sm);
  padding: 2px 8px;
  outline: none;
  background: white;
}

.mapping-group__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--gray-200);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--gray-600);
  flex-shrink: 0;
}

.mapping-group__actions {
  display: flex;
  gap: 2px;
}

.mapping-group__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  border-radius: var(--r-sm);
  cursor: pointer;
  color: var(--gray-400);
  transition: all var(--t-fast);
}

.mapping-group__btn:hover {
  background: var(--gray-200);
  color: var(--gray-700);
}

.mapping-group__btn--delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

.mapping-group__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

.mapping-group__empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--gray-400);
  border: 1px dashed var(--gray-200);
  border-radius: var(--r-sm);
}

.card-ghost {
  opacity: 0.4;
  background: rgba(0, 172, 220, 0.05);
  border: 1px dashed #00acdc;
}
</style>
