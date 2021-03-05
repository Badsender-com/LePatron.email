<script>
import BsModalConfirm from '~/components/modal-confirm.vue';

export default {
  name: `bs-workspaces-table`,
  components: {BsModalConfirm},
  props: {
    loading: {type: Boolean, default: false},
    workspaces: {type: Array, default: () => []},
  },
  computed: {
    tableHeaders() {
      return [
        {text: this.$t('global.name'), align: `left`, value: `name`},
        {text: this.$tc('global.user', 2), align: 'left', value: `users`},
        {text: this.$t('global.createdAt'), align: `left`, value: `createdAt`},
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
  methods: {
    triggerDeleteModal() {
      this.$refs.deleteWorkspaceDialog.open();
    }
  }
}
</script>

<template>
  <div>
    <v-data-table
      :headers="tableHeaders"
      :items="workspaces"
    >
      <template #item.actionDelete="{ item }">
        <v-btn
          icon
          color="primary"
          @click="triggerDeleteModal"
        >
          <v-icon>delete</v-icon>
        </v-btn>
      </template>
    </v-data-table>
    <aside class="bs-user-modals-confirmation">

      <bs-modal-confirm
        ref="deleteWorkspaceDialog"
        :title="$t('users.deleteWorkspace.title')"
        :action-label="$t('global.delete')"
        :close-label="'global.move'"
        @confirm="deleteWorkspace"
      >
        {{ $t('users.deleteWorkspace.notice')}}
      </bs-modal-confirm>

    </aside>
  </div>
</template>

