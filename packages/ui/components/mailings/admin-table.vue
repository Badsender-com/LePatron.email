<script>
export default {
  name: `bs-mailings-admin-table`,
  props: {
    mailings: { type: Array, default: () => [] },
    hiddenCols: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },
  computed: {
    tablesHeaders() {
      return [
        { text: this.$t('global.name'), align: `left`, value: `name` },
        { text: this.$t('global.author'), align: `left`, value: `userName` },
        {
          text: this.$tc('global.template', 1),
          align: `left`,
          value: `templateName`,
        },
        { text: this.$t('global.createdAt'), value: `createdAt` },
        { text: this.$t('global.updatedAt'), value: `updatedAt` },
      ].filter((column) => !this.hiddenCols.includes(column.value));
    },
  },
};
</script>

<template>
  <v-data-table :headers="tablesHeaders" :items="mailings">
    <template v-slot:item.name="{ item }">
      <!-- mailings live outside the nuxt application -->
      <a :href="`/mailings/${item.id}`">{{ item.name }}</a>
    </template>
    <template v-slot:item.userName="{ item }">
      <nuxt-link :to="`/users/${item.userId}`">{{ item.userName }}</nuxt-link>
    </template>
    <template v-slot:item.templateName="{ item }">
      <nuxt-link :to="`/templates/${item.templateId}`">{{
        item.templateName
      }}</nuxt-link>
    </template>
    <template v-slot:item.createdAt="{ item }">
      <span>{{ item.createdAt | preciseDateTime }}</span>
    </template>
    <template v-slot:item.updatedAt="{ item }">
      <span>{{ item.updatedAt | preciseDateTime }}</span>
    </template>
  </v-data-table>
</template>
