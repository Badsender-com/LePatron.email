<script>
import { Pencil, Plus, Trash2, EyeOff, Eye } from 'lucide-vue';
import BsGroupTaxonomyTab from '~/components/group/taxonomy-tab.vue';
import { dimensionActions } from '~/helpers/taxonomy-builder.js';

/**
 * One dimension the company declared, and its values. What it may do is
 * decided in helpers/taxonomy-builder.js; the requests on the dimension itself
 * are the parent's, which emits `edit`, `toggle-active` and `delete`.
 */
export default {
  name: 'BsTaxonomyCompanyDimension',
  components: {
    BsGroupTaxonomyTab,
    LucidePencil: Pencil,
    LucidePlus: Plus,
    LucideTrash2: Trash2,
    LucideEyeOff: EyeOff,
    LucideEye: Eye,
  },
  props: {
    dimension: { type: Object, required: true },
  },
  data() {
    return {
      // Unknown until the values are read: no delete offered before then.
      valueCount: null,
    };
  },
  computed: {
    actions() {
      return dimensionActions(this.dimension, {
        valueCount: this.valueCount === null ? Infinity : this.valueCount,
      });
    },
  },
};
</script>

<template>
  <section
    class="taxonomy-dimension"
    :class="{ 'taxonomy-dimension--inactive': !dimension.isActive }"
  >
    <header class="taxonomy-dimension__header">
      <h2 class="taxonomy-dimension__title">
        {{ dimension.label }}
      </h2>
      <code class="taxonomy-dimension__name">{{ dimension.name }}</code>
      <v-chip v-if="!dimension.isActive" x-small outlined>
        {{ $t('taxonomy.dimensions.inactive') }}
      </v-chip>
      <v-spacer />
      <v-btn
        text
        small
        color="accent"
        :disabled="!dimension.isActive"
        @click="$refs.values.openCreateForm()"
      >
        <lucide-plus :size="16" class="mr-1" />
        {{ $t('taxonomy.values.empty.action') }}
      </v-btn>
      <v-btn text small color="accent" @click="$emit('edit', dimension)">
        <lucide-pencil :size="16" class="mr-1" />
        {{ $t('global.edit') }}
      </v-btn>
      <v-btn
        v-if="actions.canDeactivate"
        text
        small
        color="accent"
        @click="$emit('toggle-active', dimension)"
      >
        <lucide-eye-off v-if="dimension.isActive" :size="16" class="mr-1" />
        <lucide-eye v-else :size="16" class="mr-1" />
        {{
          dimension.isActive
            ? $t('taxonomy.dimensions.deactivate')
            : $t('taxonomy.dimensions.reactivate')
        }}
      </v-btn>
      <v-btn
        v-if="actions.canDelete"
        text
        small
        color="error"
        @click="$emit('delete', dimension)"
      >
        <lucide-trash2 :size="16" class="mr-1" />
        {{ $t('global.delete') }}
      </v-btn>
    </header>
    <p v-if="dimension.description" class="taxonomy-dimension__description">
      {{ dimension.description }}
    </p>
    <p v-if="!dimension.isActive" class="taxonomy-dimension__hint">
      {{ $t('taxonomy.dimensions.inactiveHint') }}
    </p>
    <bs-group-taxonomy-tab
      ref="values"
      :dimension-name="dimension.name"
      @count="valueCount = $event"
    />
  </section>
</template>

<style lang="scss" scoped>
.taxonomy-dimension {
  margin-bottom: 2rem;

  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  &__title {
    font-size: 1rem;
    font-weight: 600;
  }

  &__name {
    font-size: 0.75rem;
  }

  &__description,
  &__hint {
    color: var(--gray-700);
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
  }
}
</style>
