<script>
import BsWorkspacesTable from '~/components/workspaces/table.vue';
import * as apiRoutes from '~/helpers/api-routes.js';
import { DATE_FORMAT } from "~/helpers/constants/date-formats.js";
import moment from 'moment';


export default {
  name: 'BsGroupWorkspacesTab',
  components: {BsWorkspacesTable},
  data() {
    return { workspaces: [] }
  },
  async mounted() {
    const {
      $axios,
      $route: { params },
    } = this;
    try {
      this.loading = true;
      const workspacesResponse = await $axios.$get(
        apiRoutes.workspacesWithUserCount(params)
      );
      console.log({workspacesResponse})
      this.workspaces = [
        ...workspacesResponse,

      ];
      this.workspaces.forEach(workspace => workspace.createdAt = moment(workspace.createdAt).format(DATE_FORMAT))
    } catch (error) {
      console.log(error);
    } finally {
      this.loading = false;
    }
  },
};
</script>

<template>
  <v-card
    flat
    tile
  >
    <v-card-text>
      <v-card elevation="2">
        <bs-workspaces-table
          :workspaces="workspaces"
        />
      </v-card>
    </v-card-text>
  </v-card>
</template>
