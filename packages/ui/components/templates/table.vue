<script>
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinCreateMailing from '~/helpers/mixin-create-mailing.js';

export default {
  name: `bs-templates-table`,
  mixins: [mixinCreateMailing],
  model: { prop: `loading`, event: `update` },
  props: {
    loading: { type: Boolean, default: false },
    templates: { type: Array, default: () => [] },
    hiddenCols: { type: Array, default: () => [] },
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: `left`, value: `name` },
        {
          text: this.$tc('global.group', 1),
          value: `group`,
          sort: (a, b) => String(b.name).localeCompare(a.name),
        },
        {
          text: this.$t('tableHeaders.templates.markup'),
          value: `hasMarkup`,
          align: `center`,
          class: `table-column-action`,
        },
        {
          text: this.$t('global.newMailing'),
          value: `actionCreateMailing`,
          sortable: false,
          align: `center`,
          class: `table-column-action`,
        },
        {
          text: this.$t('global.delete'),
          value: `actionDelete`,
          sortable: false,
          align: `center`,
          class: `table-column-action`,
        },
      ].filter((column) => !this.hiddenCols.includes(column.value));
    },
    localLoading: {
      get() {
        return this.loading;
      },
      set(newLoading) {
        this.$emit(`update`, newLoading);
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
    <template v-slot:item.name="{ item }">
      <nuxt-link :to="`/templates/${item.id}`">{{ item.name }}</nuxt-link>
    </template>
    <template v-slot:item.group="{ item }">
      <nuxt-link :to="`/groups/${item.group.id}`">{{
        item.group.name
      }}</nuxt-link>
    </template>
    <template v-slot:item.hasMarkup="{ item }">
      <v-icon v-if="item.hasMarkup">check</v-icon>
    </template>
    <template v-slot:item.actionCreateMailing="{ item }">
      <v-btn
        v-if="item.hasMarkup"
        @click="mixinCreateMailing(item, `localLoading`)"
        :disabled="loading"
        icon
        color="primary"
      >
        <v-icon>library_add</v-icon>
      </v-btn>
    </template>
    <template v-slot:item.actionDelete="{ item }">
      <v-btn @click="deleteItem(item)" disabled icon color="primary">
        <v-icon>delete</v-icon>
      </v-btn>
    </template>
  </v-data-table>
</template>
