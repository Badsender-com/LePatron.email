<script>
import { Lock, CornerDownRight, GripVertical } from 'lucide-vue';
import { moveItem } from '~/helpers/reorder.js';

/**
 * The tree of dimensions on the left of the taxonomy workspace: the standard
 * ones locked, the company's nested under their parent (ADR-0026). Its rows
 * come from helpers/taxonomy-tree.js; emits `select` with a dimension name,
 * and, when `reorderable`, `reorder` with `{ parentName, names }` after a drop
 * among siblings or Alt + an arrow key.
 */
export default {
  name: 'BsTaxonomyWorkspaceTree',
  components: {
    LucideLock: Lock,
    LucideCornerDownRight: CornerDownRight,
    LucideGripVertical: GripVertical,
  },
  props: {
    rows: { type: Array, default: () => [] },
    selected: { type: String, default: null },
    reorderable: { type: Boolean, default: false },
    // The view of the whole taxonomy shown, if any: `preview`, `precedence`.
    view: { type: String, default: null },
    // The points to check per dimension name.
    warnings: { type: Object, default: () => ({}) },
  },
  data() {
    return { dragged: null, over: null };
  },
  methods: {
    siblingsOf(row) {
      return this.rows
        .filter(
          (r) =>
            r.kind === 'dimension' &&
            !r.locked &&
            r.parentName === row.parentName
        )
        .map((r) => r.name);
    },
    canMove(row) {
      return this.reorderable && row.kind === 'dimension' && !row.locked;
    },
    move(row, target) {
      const names = this.siblingsOf(row);
      const from = names.indexOf(row.name);
      if (from === -1 || target === from) return;
      this.$emit('reorder', {
        parentName: row.parentName,
        names: moveItem(names, from, target),
      });
    },
    onDragStart(row, event) {
      this.dragged = row;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', row.name);
    },
    onDragOver(row, event) {
      if (!this.dragged || row.parentName !== this.dragged.parentName) return;
      if (row.locked) return;
      event.preventDefault();
      this.over = row.name;
    },
    onDrop(row) {
      const dragged = this.dragged;
      this.dragged = null;
      this.over = null;
      if (!dragged || row.parentName !== dragged.parentName) return;
      this.move(dragged, this.siblingsOf(row).indexOf(row.name));
    },
    onKey(row, step) {
      if (!this.canMove(row)) return;
      const names = this.siblingsOf(row);
      const target = names.indexOf(row.name) + step;
      // Already first or last: nothing to send.
      if (target < 0 || target >= names.length) return;
      this.move(row, target);
    },
  },
};
</script>

<template>
  <nav class="taxonomy-tree" :aria-label="$t('taxonomy.workspace.tree')">
    <button
      v-for="entry in ['preview', 'precedence']"
      :key="entry"
      type="button"
      class="taxonomy-tree__view"
      :class="{ 'taxonomy-tree__view--on': view === entry }"
      @click="$emit('view', entry)"
    >
      {{ $t(`taxonomy.workspace.${entry}.title`) }}
    </button>
    <template v-for="row in rows">
      <div
        v-if="row.kind === 'section'"
        :key="`section-${row.key}`"
        class="taxonomy-tree__section"
      >
        {{ $t(`taxonomy.workspace.sections.${row.key}`) }}
      </div>
      <button
        v-else
        :key="row.name"
        type="button"
        class="taxonomy-tree__node"
        :class="{
          'taxonomy-tree__node--on': row.name === selected,
          'taxonomy-tree__node--inactive': row.inactive,
        }"
        :style="{ paddingLeft: `${10 + row.depth * 18}px` }"
        :aria-current="row.name === selected ? 'page' : null"
        :draggable="canMove(row) ? 'true' : 'false'"
        :data-over="over === row.name ? 'true' : null"
        @click="$emit('select', row.name)"
        @dragstart="canMove(row) && onDragStart(row, $event)"
        @dragover="onDragOver(row, $event)"
        @dragleave="over = null"
        @drop.prevent="onDrop(row)"
        @dragend="dragged = over = null"
        @keydown.alt.up.prevent="onKey(row, -1)"
        @keydown.alt.down.prevent="onKey(row, 1)"
      >
        <lucide-grip-vertical
          v-if="canMove(row)"
          :size="14"
          class="taxonomy-tree__grip"
          :aria-label="$t('taxonomy.workspace.dragHint')"
        />
        <lucide-lock
          v-if="row.locked"
          :size="14"
          class="taxonomy-tree__icon"
          :aria-label="$t('taxonomy.dimensions.standard')"
        />
        <lucide-corner-down-right
          v-else-if="row.depth > 0"
          :size="14"
          class="taxonomy-tree__icon"
        />
        <span class="taxonomy-tree__label">{{ row.label }}</span>
        <span
          v-if="warnings[row.name]"
          class="taxonomy-tree__warn"
          :title="
            $t('taxonomy.workspace.points.title', { n: warnings[row.name] })
          "
        >
          {{ warnings[row.name] }}
        </span>
        <span class="taxonomy-tree__count">{{ row.count }}</span>
      </button>
    </template>
    <div class="taxonomy-tree__foot">
      <slot name="foot" />
    </div>
  </nav>
</template>

<style lang="scss" scoped>
.taxonomy-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;

  &__view {
    width: 100%;
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
    color: var(--v-primary-base);

    &:hover,
    &--on {
      background: rgba(0, 172, 220, 0.1);
    }
  }

  &__section {
    padding: 12px 10px 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--gray-600);
  }

  &__node {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 34px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--gray-900);
    text-align: left;
    transition: background-color 150ms;

    &:hover {
      background: var(--gray-100);
    }

    &:focus-visible {
      outline: 2px solid var(--v-accent-base);
      outline-offset: -2px;
    }

    &--on {
      background: rgba(0, 172, 220, 0.1);
      color: var(--v-primary-base);
      font-weight: 600;
    }

    &--inactive .taxonomy-tree__label {
      color: var(--gray-600);
      text-decoration: line-through;
    }
  }

  &__node[data-over='true'] {
    box-shadow: inset 0 2px 0 var(--v-accent-base);
  }

  &__grip {
    flex: none;
    color: var(--gray-500);
    cursor: grab;
  }

  &__icon {
    flex: none;
    color: var(--gray-500);
  }

  &__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__warn {
    padding: 0 6px;
    border-radius: 9999px;
    background: rgba(255, 180, 0, 0.2);
    color: #8a5a00;
    font-size: 11px;
    font-weight: 600;
  }

  &__count {
    font-size: 12px;
    color: var(--gray-600);
  }

  &__foot {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--gray-300);
  }
}
</style>
