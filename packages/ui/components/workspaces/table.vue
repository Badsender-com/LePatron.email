<script>
export default {
  name: `bs-workspaces-table`,
  props: {
    loading: { type: Boolean, default: false },
    workspaces: { type: Array, default: () => [] },
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: `center`, value: `name` },
        { text: this.$tc('global.user', 2), align:'center', value: `users`},
        { text: this.$t('global.createdAt'), align: `center`, value: `createdAt`},
        {
          text: this.$t('global.delete'),
          value: `actionDelete`,
          sortable: false,
          align: `center`,
          class: `table-column-action`,
        },
      ]
    },

  },
}
</script>

<template>
  <v-data-table
    :headers="tableHeaders"
    :items="workspaces"
  />

</template>

