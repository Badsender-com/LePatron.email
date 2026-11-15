<script>
import { Lock, CornerDownRight } from 'lucide-vue';

/**
 * The tree of dimensions on the left of the taxonomy workspace: the standard
 * ones locked, the company's nested under their parent (ADR-0026). Its rows
 * come from helpers/taxonomy-tree.js; emits `select` with a dimension name.
 */
export default {
  name: 'BsTaxonomyWorkspaceTree',
  components: {
    LucideLock: Lock,
    LucideCornerDownRight: CornerDownRight,
  },
  props: {
    rows: { type: Array, default: () => [] },
    selected: { type: String, default: null },
  },
};
</script>

<template>
  <nav class="taxonomy-tree" :aria-label="$t('taxonomy.workspace.tree')">
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
        @click="$emit('select', row.name)"
      >
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
