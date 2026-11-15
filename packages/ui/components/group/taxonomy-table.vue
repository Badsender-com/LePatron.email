<script>
import mixinTaxonomyManage from '~/helpers/mixins/mixin-taxonomy-manage.js';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import { canonicalTypeLabelKey } from '~/helpers/taxonomy.js';
import { Pencil, Trash2, GripVertical } from 'lucide-vue';
import { moveItem } from '~/helpers/reorder.js';
import BsTaxonomyTableEmpty from '~/components/group/taxonomy-table-empty.vue';

export default {
  name: 'BsTaxonomyTable',
  components: {
    BsDataTable,
    BsTaxonomyTableEmpty,
    LucidePencil: Pencil,
    LucideTrash2: Trash2,
    LucideGripVertical: GripVertical,
  },
  mixins: [mixinTaxonomyManage],
  props: {
    items: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    // The empty slot has to tell the two apart: "you have none" and "we could
    // not read them" lead to opposite actions.
    loadError: { type: Boolean, default: false },
    // The email type maps a value onto the doctrine's six types; any other
    // dimension shows the value's own identifier.
    isEmailType: { type: Boolean, default: true },
    // Rows ordered by drag and drop, or Alt + arrows on a grip: emits
    // `reorder` with every id in the new order (ADR-0026).
    reorderable: { type: Boolean, default: false },
    // A deactivated dimension takes no new value.
    canCreate: { type: Boolean, default: true },
  },
  data() {
    return { dragged: null };
  },
  computed: {
    wording() {
      return this.isEmailType ? 'taxonomy' : 'taxonomy.values';
    },
    headers() {
      const canReorder = this.reorderable && this.canManageTaxonomy;
      const headers = canReorder
        ? [{ text: '', value: 'grip', sortable: false, width: 36 }]
        : [];
      headers.push({ text: this.$t('taxonomy.table.label'), value: 'label' });

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
          text: this.isEmailType
            ? this.$t('taxonomy.table.canonicalType')
            : this.$t('taxonomy.values.form.identifier'),
          value: 'canonicalType',
        },
        ...(canReorder
          ? []
          : [{ text: this.$t('taxonomy.table.order'), value: 'order' }]),
        { text: this.$t('taxonomy.table.isActive'), value: 'isActive' }
      );
      if (this.canManageTaxonomy) {
        headers.push({
          text: this.$t('global.actions'),
          value: 'actions',
          sortable: false,
          align: 'right',
        });
      }

      return headers;
    },
  },
  methods: {
    moveTo(id, target) {
      const ids = this.items.map((item) => item.id);
      const from = ids.indexOf(id);
      if (from === -1 || target === from || target < 0) return;
      if (target >= ids.length) return;
      this.$emit('reorder', moveItem(ids, from, target));
    },
    rowIdOf(event) {
      const row = event.target.closest && event.target.closest('tr');
      const grip = row && row.querySelector('[data-value-id]');
      return grip ? grip.getAttribute('data-value-id') : null;
    },
    onDragOver(event) {
      if (this.dragged && this.rowIdOf(event)) event.preventDefault();
    },
    onDrop(event) {
      const target = this.rowIdOf(event);
      const dragged = this.dragged;
      this.dragged = null;
      if (!dragged || !target) return;
      this.moveTo(
        dragged,
        this.items.findIndex((item) => item.id === target)
      );
    },
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
    :disable-sort="reorderable"
    :items-per-page="reorderable ? -1 : undefined"
    :headers="headers"
    :items="items"
    :loading="loading"
    :clickable="canManageTaxonomy"
    @dragover.native="onDragOver"
    @drop.native.prevent="onDrop"
    @dragend.native="dragged = null"
    @click:row="canManageTaxonomy && $emit('edit', $event)"
  >
    <template #item.grip="{ item, index }">
      <span
        class="taxonomy-table__grip"
        draggable="true"
        tabindex="0"
        role="button"
        :data-value-id="item.id"
        :aria-label="$t('taxonomy.workspace.dragHint')"
        @click.stop
        @dragstart="dragged = item.id"
        @keydown.alt.up.prevent="moveTo(item.id, index - 1)"
        @keydown.alt.down.prevent="moveTo(item.id, index + 1)"
      >
        <lucide-grip-vertical :size="16" />
      </span>
    </template>

    <template #item.label="{ item }">
      <span class="taxonomy-table__label">{{ item.label }}</span>
      <v-chip
        v-if="item.isDefault || (item.defaultUnder || []).length > 0"
        x-small
        outlined
        class="ml-2"
      >
        {{ $t('taxonomy.values.form.defaultChip') }}
      </v-chip>
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
      <code v-if="item.canonicalType && !isEmailType">
        {{ item.canonicalType }}
      </code>
      <v-chip v-else-if="item.canonicalType" small outlined color="accent">
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
      <bs-taxonomy-table-empty
        :load-error="loadError"
        :is-email-type="isEmailType"
        :wording="wording"
        :can-create="canCreate"
        @retry="$emit('retry')"
        @create="$emit('create')"
        @restore-defaults="$emit('restore-defaults')"
      />
    </template>
  </bs-data-table>
</template>

<style lang="scss" scoped>
.taxonomy-table__grip {
  display: inline-flex;
  color: var(--gray-500);
  cursor: grab;

  &:focus-visible {
    outline: 2px solid var(--v-accent-base);
    border-radius: 4px;
  }
}

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
