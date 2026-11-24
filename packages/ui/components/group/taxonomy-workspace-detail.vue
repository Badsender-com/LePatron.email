<script>
import { PanelLeft } from 'lucide-vue';
import BsTaxonomyEmailTypeDimension from '~/components/group/taxonomy-email-type-dimension.vue';
import BsTaxonomyTriggerDimension from '~/components/group/taxonomy-trigger-dimension.vue';
import BsTaxonomyCompanyDimension from '~/components/group/taxonomy-company-dimension.vue';
import BsTaxonomyDimensionSettings from '~/components/group/taxonomy-dimension-settings.vue';
import BsTaxonomyCrossingsMatrix from '~/components/group/taxonomy-crossings-matrix.vue';
import BsTaxonomyDefaultValue from '~/components/group/taxonomy-default-value.vue';
import BsTaxonomyDimensionTemplates from '~/components/group/taxonomy-dimension-templates.vue';
import BsTaxonomyPointsCallout from '~/components/group/taxonomy-points-callout.vue';
import BsTaxonomyDimensionTokens from '~/components/group/taxonomy-dimension-tokens.vue';

/**
 * The selected dimension of the taxonomy workspace, in segments (ADR-0026).
 * The requests are the workspace's: this emits `select-tab`, `toggle-tree`,
 * `edit`, `move`, `add-child`, `toggle-active`, `delete`, `count`, `saved`,
 * `error` and `preview`.
 */
export default {
  name: 'BsTaxonomyWorkspaceDetail',
  components: {
    BsTaxonomyEmailTypeDimension,
    BsTaxonomyTriggerDimension,
    BsTaxonomyCompanyDimension,
    BsTaxonomyDimensionSettings,
    BsTaxonomyCrossingsMatrix,
    BsTaxonomyDefaultValue,
    BsTaxonomyDimensionTemplates,
    BsTaxonomyPointsCallout,
    BsTaxonomyDimensionTokens,
    LucidePanelLeft: PanelLeft,
  },
  props: {
    dimension: { type: Object, required: true },
    parent: { type: Object, default: null },
    segments: { type: Array, default: () => ['values'] },
    tab: { type: String, default: 'values' },
    treeOpen: { type: Boolean, default: false },
    // Values per dimension name, for the crossings and the defaults.
    valuesByType: { type: Object, default: () => ({}) },
    templates: { type: Array, default: () => [] },
    points: { type: Array, default: () => [] },
  },
  data() {
    return { dirty: false };
  },
  methods: {
    // Asked before the workspace selects elsewhere: an unsaved matrix warns.
    confirmLeave() {
      if (!this.dirty) return true;
      const leave = window.confirm(
        this.$t('taxonomy.workspace.crossings.leave')
      );
      if (leave) this.dirty = false;
      return leave;
    },
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

    <bs-taxonomy-points-callout
      :points="points"
      :values="Object.values(valuesByType).flat()"
      :templates="templates"
      @go="$emit('select-tab', $event)"
    />
    <bs-taxonomy-crossings-matrix
      v-if="tab === 'crossings' && parent"
      :dimension="dimension"
      :parent="parent"
      :parent-values="valuesByType[parent.name] || []"
      :child-values="valuesByType[dimension.name] || []"
      @dirty="dirty = $event"
      @saved="$emit('saved')"
      @error="$emit('error', $event)"
    />
    <bs-taxonomy-default-value
      v-else-if="tab === 'defaults'"
      :dimension="dimension"
      :values="valuesByType[dimension.name] || []"
      @saved="$emit('saved')"
      @error="$emit('error', $event)"
    />
    <bs-taxonomy-dimension-tokens
      v-else-if="tab === 'tokens'"
      :dimension="dimension"
      :values="valuesByType[dimension.name] || []"
    />
    <bs-taxonomy-dimension-templates
      v-else-if="tab === 'templates'"
      :dimension="dimension"
      :templates="templates"
      :values="valuesByType[dimension.name] || []"
      @preview="$emit('preview', $event)"
    />
    <bs-taxonomy-dimension-settings
      v-else-if="tab === 'settings'"
      :dimension="dimension"
      :parent="parent"
      @edit="$emit('edit', $event)"
      @move="$emit('move', $event)"
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
      @add-child="$emit('add-child', $event)"
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
      background: #fff;
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
