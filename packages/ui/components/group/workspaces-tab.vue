<script>
import * as apiRoutes from '~/helpers/api-routes.js';
import { DATE_FORMAT } from '~/helpers/constants/date-formats.js';
import moment from 'moment';

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
  async mounted() {
    const { $axios } = this;
    try {
      this.loading = true;
      const workspacesResponse = await $axios.$get(
        apiRoutes.workspacesWithUserCount()
      );
      this.workspaces = [...workspacesResponse];
      this.workspaces.map((workspace) => {
        workspace.createdAt = moment(workspace.createdAt).format(DATE_FORMAT);
        return workspace;
      });
    } catch (error) {
      console.log(error);
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
