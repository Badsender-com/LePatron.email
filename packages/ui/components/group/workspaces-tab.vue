<script>
import { groupsWorkspaces } from '~/helpers/api-routes.js';
import { DATE_FORMAT } from '~/helpers/constants/date-formats.js';
import moment from 'moment';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export default {
  name: 'BsGroupWorkspacesTab',
  data() {
    return {
      workspaces: [],
      dialogDelete: false,
      loading: false,
    };
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        { text: this.$tc('global.user', 2), align: 'left', value: 'users' },
        {
          text: this.$t('global.createdAt'),
          align: 'left',
          value: 'createdAt',
        },
        {
          text: this.$t('tableHeaders.workspaces.delete'),
          value: 'actionDelete',
          align: 'center',
          sortable: false,
        },
      ];
    },
  },
  watch: {
    dialogDelete(val) {
      val || this.closeDelete();
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    closeDelete() {
      this.dialogDelete = false;
    },
    deleteItem(item) {
      this.dialogDelete = true;
      console.log({
        item,
      });
    },
    deleteItemConfirm(item) {
      console.log({
        item,
      });
      this.closeDelete();
    },
  },
  async mounted() {
    const {
      $axios,
      $route: { params },
    } = this;
    try {
      this.loading = true;
      const workspacesResponse = await $axios.$get(groupsWorkspaces(params));
      this.workspaces = workspacesResponse?.items?.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        users: workspace?._users?.length,
        createdAt: moment(workspace.createdAt).format(DATE_FORMAT),
      }));
    } catch (error) {
      this.showSnackbar({
        text: this.$t('global.errors.errorOccured'),
        color: 'error',
      });
    } finally {
      this.loading = false;
    }
  },
};
</script>

<template>
  <v-card flat tile>
    <v-card-text>
      <v-card elevation="2">
        <v-skeleton-loader v-if="loading" :loading="loading" type="table" />
        <v-dialog v-model="dialogDelete" max-width="500px">
          <v-card>
            <v-card-title class="headline">
              Are you sure you want to delete this item?
            </v-card-title>
            <v-card-actions>
              <v-spacer />
              <v-btn color="blue darken-1" text @click="closeDelete">
                Cancel
              </v-btn>
              <v-btn color="blue darken-1" text @click="deleteItemConfirm">
                OK
              </v-btn>
              <v-spacer />
            </v-card-actions>
          </v-card>
        </v-dialog>
        <v-data-table
          v-show="!loading"
          :loading="loading"
          :headers="tableHeaders"
          :items="workspaces"
        >
          <template #item.actionDelete="{ item }">
            <v-icon small @click="deleteItem(item)">
              mdi-delete
            </v-icon>
          </template>
        </v-data-table>
      </v-card>
    </v-card-text>
  </v-card>
</template>
