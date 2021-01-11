<script>
import { mapGetters } from 'vuex'

import { USER, IS_ADMIN } from '~/store/user.js'

const TABLE_HIDDEN_COLUMNS_ADMIN = [`userName`]
const TABLE_HIDDEN_COLUMNS_USER = [`actionTransfer`]

export default {
  name: `bs-mailings-table`,
  model: { prop: `mailingsSelection`, event: `input` },
  props: {
    mailings: { type: Array, default: () => [] },
    mailingsSelection: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },
  computed: {
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    hiddenCols() {
      return this.isAdmin
        ? TABLE_HIDDEN_COLUMNS_ADMIN
        : TABLE_HIDDEN_COLUMNS_USER
    },
    localSelection: {
      get() {
        return this.mailingsSelection
      },
      set(newSelection) {
        this.$emit(`input`, newSelection)
      },
    },
    tablesHeaders() {
      return [
        { text: this.$t(`global.name`), align: `left`, value: `name` },
        { text: this.$t(`global.author`), align: `left`, value: `userName` },
        {
          text: this.$tc(`global.template`, 1),
          align: `left`,
          value: `templateName`,
        },
        {
          text: this.$t(`global.tags`),
          align: `left`,
          value: `tags`,
          sortable: false,
        },
        { text: this.$t(`global.createdAt`), value: `createdAt` },
        { text: this.$t(`global.updatedAt`), value: `updatedAt` },
        {
          text: this.$t(`tableHeaders.mailings.rename`),
          value: `actionRename`,
          align: `center`,
          class: `table-column-action`,
          sortable: false,
        },
        {
          text: this.$t(`tableHeaders.mailings.transfer`),
          value: `actionTransfer`,
          align: `center`,
          class: `table-column-action`,
          sortable: false,
        },
        {
          text: this.$t(`global.duplicate`),
          value: `actionDuplicate`,
          align: `center`,
          class: `table-column-action`,
          sortable: false,
        },
      ].filter(column => !this.hiddenCols.includes(column.value))
    },
    tableOptions() {
      return {
        sortBy: [`updatedAt`],
        sortDesc: [true],
      }
    },
  },
  methods: {
    renameMailing(mailing) {
      this.$emit(`rename`, mailing)
    },
    transferMailing(mailing) {
      this.$emit(`transfer`, mailing)
    },
    duplicateMailing(mailing) {
      this.$emit(`duplicate`, mailing)
    },
  },
}
</script>

<template>
  <v-data-table
    :headers="tablesHeaders"
    :options="tableOptions"
    :items="mailings"
    :loading="loading"
    show-select
    v-model="localSelection"
  >
    <template v-slot:item.name="{ item }">
      <a :href="`/mailings/${item.id}`">{{ item.name }}</a>
    </template>
    <template v-slot:item.userName="{ item }">
      <nuxt-link v-if="isAdmin" :to="`/users/${item.userId}`">{{ item.userName }}</nuxt-link>
      <span v-else>{{ item.userName }}</span>
    </template>
    <template v-slot:item.templateName="{ item }">
      <nuxt-link v-if="isAdmin" :to="`/templates/${item.templateId}`">{{item.templateName }}</nuxt-link>
      <span v-else>{{ item.templateName }}</span>
    </template>
    <template v-slot:item.tags="{ item }">
      <span>{{ item.tags.join(`, `) }}</span>
    </template>
    <template v-slot:item.createdAt="{ item }">
      <span>{{ item.createdAt | preciseDateTime }}</span>
    </template>
    <template v-slot:item.updatedAt="{ item }">
      <span>{{ item.updatedAt | preciseDateTime }}</span>
    </template>
    <template v-slot:item.actionRename="{ item }">
      <v-btn @click="renameMailing(item)" :disabled="loading" icon color="primary">
        <v-icon>title</v-icon>
      </v-btn>
    </template>
    <template v-slot:item.actionTransfer="{ item }">
      <v-btn @click="transferMailing(item)" :disabled="loading" icon color="primary">
        <v-icon>forward</v-icon>
      </v-btn>
    </template>
    <template v-slot:item.actionDuplicate="{ item }">
      <v-btn @click="duplicateMailing(item)" :disabled="loading" icon color="primary">
        <v-icon>content_copy</v-icon>
      </v-btn>
    </template>
  </v-data-table>
</template>
