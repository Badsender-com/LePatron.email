<script>
export default {
  name: 'BsMailingsAdminTable',
  props: {
    mailings: { type: Array, default: () => [] },
    hiddenCols: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: { type: Object, default: () => ({}) },
  },
  computed: {
    tablesHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        { text: this.$t('global.author'), align: 'left', value: 'userName' },
        {
          text: this.$tc('global.template', 1),
          align: 'left',
          value: 'templateName',
        },
        { text: this.$t('global.createdAt'), value: 'createdAt' },
        { text: this.$t('global.updatedAt'), value: 'updatedAt' },
      ].filter((column) => !this.hiddenCols.includes(column.value));
    },
  },
  methods: {
    handleItemsPerPageChange(itemsPerPage) {
      this.$emit('update:items-per-page', itemsPerPage);
    },
  },
};
</script>

<template>
  <v-data-table
    :headers="tablesHeaders"
    :items="mailings"
    :loading="loading"
    v-bind="$attrs"
    @update:items-per-page="handleItemsPerPageChange"
  >
    <template #item.name="{ item }">
      <!-- mailings live outside the nuxt application -->
      <a :href="`/editor/${item.id}`">{{ item.name }}</a>
    </template>
    <template #item.userName="{ item }">
      <nuxt-link :to="`/users/${item.userId}`">
        {{ item.userName }}
      </nuxt-link>
    </template>
    <template #item.templateName="{ item }">
      <nuxt-link :to="`/templates/${item.templateId}`">
        {{ item.templateName }}
      </nuxt-link>
    </template>
    <template #item.createdAt="{ item }">
      <span>{{ item.createdAt | preciseDateTime }}</span>
    </template>
    <template #item.updatedAt="{ item }">
      <span>{{ item.updatedAt | preciseDateTime }}</span>
    </template>
  </v-data-table>
</template>
