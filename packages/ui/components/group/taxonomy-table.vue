<script>
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import { canonicalTypeLabelKey } from '~/helpers/taxonomy.js';
import { Tags, Pencil, Trash2 } from 'lucide-vue';

export default {
  name: 'BsTaxonomyTable',
  components: {
    BsDataTable,
    LucideTags: Tags,
    LucidePencil: Pencil,
    LucideTrash2: Trash2,
  },
  props: {
    items: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },
  computed: {
    headers() {
      const headers = [
        { text: this.$t('taxonomy.table.label'), value: 'label' },
      ];

      // Dropped below `lg` as a readability choice, not because anything breaks:
      // Vuetify's own wrapper scrolls horizontally, so the columns past the edge
      // are reachable — just not visibly, since the scrollbar is an overlay. A
      // settings table you have to scroll sideways to reach the delete button is
      // a poor screen, and the definition is the column that can go: it is
      // truncated to a single line here, and reading it in full means opening the
      // row anyway.
      if (this.$vuetify.breakpoint.lgAndUp) {
        headers.push({
          text: this.$t('taxonomy.table.description'),
          value: 'description',
          sortable: false,
        });
      }

      headers.push(
        {
          text: this.$t('taxonomy.table.canonicalType'),
          value: 'canonicalType',
        },
        { text: this.$t('taxonomy.table.order'), value: 'order' },
        { text: this.$t('taxonomy.table.isActive'), value: 'isActive' },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          sortable: false,
          align: 'right',
        }
      );

      return headers;
    },
  },
  methods: {
    canonicalTypeLabel(item) {
      const key = canonicalTypeLabelKey(item.canonicalType);
      // An unknown value is shown as-is rather than as a missing i18n key: the
      // server accepts any string here on purpose.
      return key ? this.$t(key) : item.canonicalType;
    },
  },
};
</script>

<template>
  <bs-data-table
    :headers="headers"
    :items="items"
    :loading="loading"
    clickable
    @click:row="$emit('edit', $event)"
  >
    <template #item.label="{ item }">
      <span class="taxonomy-table__label">{{ item.label }}</span>
    </template>

    <template #item.description="{ item }">
      <span
        v-if="item.description"
        class="taxonomy-table__description"
        :title="item.description"
      >
        {{ item.description }}
      </span>
      <span v-else class="taxonomy-table__empty-cell">—</span>
    </template>

    <template #item.canonicalType="{ item }">
      <v-chip v-if="item.canonicalType" small outlined color="accent">
        {{ canonicalTypeLabel(item) }}
      </v-chip>
      <span v-else class="taxonomy-table__empty-cell">—</span>
    </template>

    <template #item.isActive="{ item }">
      <v-chip
        small
        :color="item.isActive ? 'success' : 'grey'"
        :outlined="!item.isActive"
        :dark="item.isActive"
      >
        {{ item.isActive ? $t('taxonomy.active') : $t('taxonomy.inactive') }}
      </v-chip>
    </template>

    <template #item.actions="{ item }">
      <div class="d-flex align-center justify-end">
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              v-bind="attrs"
              v-on="on"
              @click.stop="$emit('edit', item)"
            >
              <lucide-pencil :size="18" />
            </v-btn>
          </template>
          <span>{{ $t('global.edit') }}</span>
        </v-tooltip>
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              v-bind="attrs"
              v-on="on"
              @click.stop="$emit('delete', item)"
            >
              <lucide-trash2 :size="18" class="error--text" />
            </v-btn>
          </template>
          <span>{{ $t('global.delete') }}</span>
        </v-tooltip>
      </div>
    </template>

    <template #no-data>
      <div class="text-center pa-6">
        <lucide-tags :size="48" class="grey--text text--lighten-1" />
        <p class="text-body-1 grey--text mt-4 mb-1">
          {{ $t('taxonomy.empty.title') }}
        </p>
        <p class="text-body-2 grey--text text--darken-1">
          {{ $t('taxonomy.empty.description') }}
        </p>
        <v-btn color="accent" elevation="0" @click="$emit('create')">
          {{ $t('taxonomy.empty.action') }}
        </v-btn>
      </div>
    </template>
  </bs-data-table>
</template>

<style lang="scss" scoped>
.taxonomy-table {
  &__label {
    display: block;
    // Without this the column collapses to its narrowest word and a two-word
    // label stacks over three lines.
    min-width: 11rem;
  }

  &__description {
    display: block;
    max-width: 18rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--gray-700);
  }

  &__empty-cell {
    // --gray-500 would sit under the AA contrast threshold; the dash carries no
    // information anyway, but it should still be readable.
    color: var(--gray-700);
  }
}
</style>
