<script>
import mixinTaxonomyManage from '~/helpers/mixins/mixin-taxonomy-manage.js';
import * as apiRoutes from '~/helpers/api-routes.js';

/**
 * The Defaults segment of a first-level dimension (ADR-0024): the value a new
 * email takes when its template gives none, or none. Saved at once: the value
 * holding the place is unmarked first. Emits `saved` and `error`.
 */
export default {
  name: 'BsTaxonomyDefaultValue',
  mixins: [mixinTaxonomyManage],
  props: {
    dimension: { type: Object, required: true },
    values: { type: Array, default: () => [] },
  },
  data() {
    return { saving: false };
  },
  computed: {
    current() {
      const holder = this.values.find((value) => value.isDefault);
      return holder ? String(holder.id) : null;
    },
    options() {
      return this.values.filter(
        (value) => value.isActive !== false || value.isDefault
      );
    },
  },
  methods: {
    async choose(id) {
      if (id === this.current || this.saving) return;
      const patch = (itemId, isDefault) =>
        this.$axios.$patch(apiRoutes.taxonomyItemsItem(itemId), { isDefault });
      try {
        this.saving = true;
        if (this.current) await patch(this.current, false);
        if (id) await patch(id, true);
        this.$emit('saved');
      } catch (error) {
        this.$emit('error', error);
        this.$emit('saved');
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<template>
  <section class="default-value">
    <p class="default-value__intro">
      {{ $t('taxonomy.workspace.defaults.intro', { label: dimension.label }) }}
    </p>
    <v-radio-group
      :value="current"
      :disabled="!canManageTaxonomy || saving"
      class="mt-0"
      hide-details
      @change="choose"
    >
      <v-radio :value="null" :label="$t('taxonomy.workspace.defaults.none')" />
      <v-radio
        v-for="value in options"
        :key="value.id"
        :value="String(value.id)"
        :label="value.label"
      />
    </v-radio-group>
    <p class="default-value__hint">
      {{ $t('taxonomy.workspace.defaults.hint') }}
    </p>
  </section>
</template>

<style lang="scss" scoped>
.default-value {
  max-width: 560px;

  &__intro,
  &__hint {
    font-size: 13px;
    color: var(--gray-700);
  }

  &__hint {
    margin-top: 12px;
    font-size: 12px;
    color: var(--gray-600);
  }
}
</style>
