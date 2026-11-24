<script>
import mixinTaxonomyManage from '~/helpers/mixins/mixin-taxonomy-manage.js';
import { Pencil, Plus, RotateCcw } from 'lucide-vue';
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
    LucidePlus: Plus,
    LucideRotateCcw: RotateCcw,
  },
  mixins: [mixinTaxonomyManage],
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
        v-if="canManageTaxonomy"
        text
        small
        color="accent"
        @click="$refs.values.openRestoreDefaults()"
      >
        <lucide-rotate-ccw :size="16" class="mr-1" />
        {{ $t('taxonomy.defaults.action') }}
      </v-btn>
      <v-btn
        v-if="canManageTaxonomy"
        text
        small
        color="accent"
        @click="$refs.values.openCreateForm()"
      >
        <lucide-plus :size="16" class="mr-1" />
        {{ $t('taxonomy.empty.action') }}
      </v-btn>
      <v-btn
        v-if="dimension && canManageTaxonomy"
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
    <bs-group-taxonomy-tab ref="values" @values="$emit('values', $event)" />
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
