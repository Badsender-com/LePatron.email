<script>
import { Pencil } from 'lucide-vue';
import BsGroupTaxonomyTab from '~/components/group/taxonomy-tab.vue';

/**
 * The email type and its values. Its section stands even when the dimension
 * could not be read, under its default title. Emits `edit` with the dimension.
 */
export default {
  name: 'BsTaxonomyEmailTypeDimension',
  components: {
    BsGroupTaxonomyTab,
    LucidePencil: Pencil,
  },
  props: {
    dimension: { type: Object, default: null },
  },
  methods: {
    // The page header's actions act on the email type's values.
    openCreateForm() {
      this.$refs.values.openCreateForm();
    },

    openRestoreDefaults() {
      this.$refs.values.openRestoreDefaults();
    },
  },
};
</script>

<template>
  <section class="taxonomy-dimension">
    <header class="taxonomy-dimension__header">
      <h2 class="taxonomy-dimension__title">
        {{ dimension ? dimension.label : $t('taxonomy.dimensions.emailType') }}
      </h2>
      <v-chip x-small outlined color="accent">
        {{ $t('taxonomy.dimensions.standard') }}
      </v-chip>
      <v-spacer />
      <v-btn
        v-if="dimension"
        text
        small
        color="accent"
        @click="$emit('edit', dimension)"
      >
        <lucide-pencil :size="16" class="mr-1" />
        {{ $t('global.edit') }}
      </v-btn>
    </header>
    <p
      v-if="dimension && dimension.description"
      class="taxonomy-dimension__description"
    >
      {{ dimension.description }}
    </p>
    <p class="taxonomy-dimension__hint">
      {{ $t('taxonomy.emailTypeHint') }}
    </p>
    <bs-group-taxonomy-tab ref="values" />
  </section>
</template>

<style lang="scss" scoped>
.taxonomy-dimension {
  margin-bottom: 2rem;

  &__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  &__title {
    font-size: 1rem;
    font-weight: 600;
  }

  &__description,
  &__hint {
    color: var(--gray-700);
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
  }
}
</style>
