<script>
import { groupsWorkspaces } from '~/helpers/api-routes.js';
import { DATE_FORMAT } from '~/helpers/constants/date-formats.js';
import moment from 'moment';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export default {
  name: 'BsGroupWorkspacesTab',
  data() {
    return { workspaces: [] };
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
      ];
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
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
        <v-data-table :headers="tableHeaders" :items="workspaces" />
      </v-card>
    </v-card-text>
  </v-card>
</template>
