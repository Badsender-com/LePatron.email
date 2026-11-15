<script>
import { PanelLeft } from 'lucide-vue';
import BsTaxonomyEmailTypeDimension from '~/components/group/taxonomy-email-type-dimension.vue';
import BsTaxonomyTriggerDimension from '~/components/group/taxonomy-trigger-dimension.vue';
import BsTaxonomyCompanyDimension from '~/components/group/taxonomy-company-dimension.vue';
import BsTaxonomyDimensionSettings from '~/components/group/taxonomy-dimension-settings.vue';

/**
 * The selected dimension of the taxonomy workspace, in segments (ADR-0026).
 * The requests are the workspace's: this emits `select-tab`, `toggle-tree`,
 * `edit`, `toggle-active`, `delete` and `count`.
 */
export default {
  name: 'BsTaxonomyWorkspaceDetail',
  components: {
    BsTaxonomyEmailTypeDimension,
    BsTaxonomyTriggerDimension,
    BsTaxonomyCompanyDimension,
    BsTaxonomyDimensionSettings,
    LucidePanelLeft: PanelLeft,
  },
  props: {
    dimension: { type: Object, required: true },
    parent: { type: Object, default: null },
    segments: { type: Array, default: () => ['values'] },
    tab: { type: String, default: 'values' },
    treeOpen: { type: Boolean, default: false },
  },
};
</script>

<template>
  <section class="taxonomy-detail">
    <div class="taxonomy-detail__bar">
      <v-btn
        class="taxonomy-detail__tree-toggle"
        text
        small
        :aria-expanded="treeOpen ? 'true' : 'false'"
        @click="$emit('toggle-tree')"
      >
        <lucide-panel-left :size="16" class="mr-1" />
        {{ $t('taxonomy.workspace.tree') }}
      </v-btn>
      <nav
        v-if="segments.length > 1"
        class="taxonomy-detail__segments"
        :aria-label="$t('taxonomy.workspace.segmentsLabel')"
      >
        <button
          v-for="segment in segments"
          :key="segment"
          type="button"
          class="taxonomy-detail__segment"
          :class="{
            'taxonomy-detail__segment--on': segment === tab,
          }"
          :aria-current="segment === tab ? 'page' : null"
          @click="$emit('select-tab', segment)"
        >
          {{ $t(`taxonomy.workspace.segments.${segment}`) }}
        </button>
      </nav>
    </div>

    <bs-taxonomy-dimension-settings
      v-if="tab === 'settings'"
      :dimension="dimension"
      :parent="parent"
      @edit="$emit('edit', $event)"
    />
    <bs-taxonomy-email-type-dimension
      v-else-if="dimension.name === 'emailType'"
      :key="`${$route.params.groupId}-emailType`"
      :dimension="dimension"
      @edit="$emit('edit', $event)"
      @count="$emit('count', $event)"
    />
    <bs-taxonomy-trigger-dimension
      v-else-if="dimension.name === 'trigger'"
      :dimension="dimension"
      @edit="$emit('edit', $event)"
    />
    <bs-taxonomy-company-dimension
      v-else
      :key="`${$route.params.groupId}-${dimension.name}`"
      :dimension="dimension"
      :parent="parent"
      @edit="$emit('edit', $event)"
      @toggle-active="$emit('toggle-active', $event)"
      @delete="$emit('delete', $event)"
      @count="$emit('count', $event)"
    />
  </section>
</template>

<style lang="scss" scoped>
.taxonomy-detail {
  min-width: 0;

  &__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__segments {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 3px;
    background: var(--gray-100);
    border-radius: 7px;
  }

  &__segment {
    padding: 6px 14px;
    border-radius: 5px;
    font-size: 13px;
    font-weight: 500;
    color: var(--gray-700);
    transition: background-color 150ms, color 150ms;

    &:hover {
      color: var(--v-primary-base);
    }

    &:focus-visible {
      outline: 2px solid var(--v-accent-base);
    }

    &--on {
      background: var(--white);
      color: var(--v-primary-base);
      box-shadow: 0 1px 2px rgba(13, 43, 62, 0.08);
    }
  }

  &__tree-toggle {
    display: none;
  }

  @media (max-width: 959px) {
    &__tree-toggle {
      display: inline-flex;
    }
  }
}
</style>
