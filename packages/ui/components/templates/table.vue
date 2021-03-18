<script>
import mixinCreateMailing from '~/helpers/mixin-create-mailing.js';

export default {
  name: 'BsTemplatesTable',
  mixins: [mixinCreateMailing],
  model: { prop: 'loading', event: 'update' },
  props: {
    loading: { type: Boolean, default: false },
    templates: { type: Array, default: () => [] },
    hiddenCols: { type: Array, default: () => [] },
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        {
          text: this.$tc('global.group', 1),
          value: 'group',
          sort: (a, b) => String(b.name).localeCompare(a.name),
        },
        {
          text: this.$t('tableHeaders.templates.markup'),
          value: 'hasMarkup',
          align: 'center',
          class: 'table-column-action',
        },
        {
          text: this.$t('global.delete'),
          value: 'actionDelete',
          sortable: false,
          align: 'center',
          class: 'table-column-action',
        },
      ].filter((column) => !this.hiddenCols.includes(column.value));
    },
    localLoading: {
      get() {
        return this.loading;
      },
      set(newLoading) {
        this.$emit('update', newLoading);
      },
    },
  },
  methods: {
    async deleteItem(item) {
      console.log(item);
    },
  },
};
</script>

<template>
  <v-data-table :headers="tableHeaders" :items="templates" class="elevation-1">
    <template #item.name="{ item }">
      <nuxt-link :to="`/templates/${item.id}`">
        {{ item.name }}
      </nuxt-link>
    </template>
    <template #item.group="{ item }">
      <nuxt-link :to="`/groups/${item.group.id}`">
        {{ item.group.name }}
      </nuxt-link>
    </template>
    <template #item.hasMarkup="{ item }">
      <v-icon v-if="item.hasMarkup">
        check
      </v-icon>
    </template>
    <template #item.actionDelete="{ item }">
      <v-btn disabled icon color="primary" @click="deleteItem(item)">
        <v-icon>delete</v-icon>
      </v-btn>
    </template>
  </v-data-table>
</template>
