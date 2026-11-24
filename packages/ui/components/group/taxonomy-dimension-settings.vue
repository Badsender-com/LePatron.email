<script>
import mixinTaxonomyManage from '~/helpers/mixins/mixin-taxonomy-manage.js';
import { Pencil, Move } from 'lucide-vue';

/**
 * The Settings segment of a dimension: what it is, where it hangs and which
 * emails offer it. Changed through the dimension's form, opened by `edit`.
 */
export default {
  name: 'BsTaxonomyDimensionSettings',
  components: { LucidePencil: Pencil, LucideMove: Move },
  mixins: [mixinTaxonomyManage],
  props: {
    dimension: { type: Object, required: true },
    parent: { type: Object, default: null },
  },
  computed: {
    rows() {
      const d = this.dimension;
      const none = this.$t('taxonomy.workspace.settings.none');
      return [
        { key: 'label', value: d.label },
        { key: 'name', value: d.name, mono: true },
        { key: 'parent', value: this.parent ? this.parent.label : none },
        {
          key: 'role',
          value: d.role ? this.$t(`taxonomy.dimensions.roles.${d.role}`) : none,
        },
        {
          key: 'scope',
          value: this.$t(`taxonomy.dimensions.scopes.${d.scope || 'all'}`),
        },
        { key: 'description', value: d.description || none },
        {
          key: 'status',
          value:
            d.isActive === false
              ? this.$t('taxonomy.dimensions.inactive')
              : this.$t('taxonomy.active'),
        },
      ];
    },
  },
};
</script>

<template>
  <section class="taxonomy-settings">
    <dl class="taxonomy-settings__list">
      <template v-for="row in rows">
        <dt :key="`${row.key}-term`">
          {{ $t(`taxonomy.workspace.settings.${row.key}`) }}
        </dt>
        <dd :key="`${row.key}-value`">
          <code v-if="row.mono">{{ row.value }}</code>
          <template v-else>{{ row.value }}</template>
        </dd>
      </template>
    </dl>
    <p class="taxonomy-settings__hint">
      {{ $t('taxonomy.workspace.settings.nameFinal') }}
    </p>
    <div v-if="canManageTaxonomy" class="taxonomy-settings__actions">
      <v-btn outlined color="accent" @click="$emit('edit', dimension)">
        <lucide-pencil :size="16" class="mr-2" />
        {{ $t('global.edit') }}
      </v-btn>
      <v-btn
        v-if="!dimension.standard"
        text
        color="accent"
        @click="$emit('move', dimension)"
      >
        <lucide-move :size="16" class="mr-2" />
        {{ $t('taxonomy.workspace.move.open') }}
      </v-btn>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.taxonomy-settings {
  max-width: 640px;

  &__list {
    display: grid;
    grid-template-columns: minmax(120px, 200px) minmax(0, 1fr);
    gap: 10px 16px;
    margin: 0 0 12px;
    font-size: 13px;

    dt {
      color: var(--gray-600);
      font-weight: 500;
    }

    dd {
      margin: 0;
      color: var(--gray-900);
      overflow-wrap: anywhere;
    }
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__hint {
    font-size: 12px;
    color: var(--gray-600);
  }
}
</style>
