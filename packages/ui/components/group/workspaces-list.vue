<script>
import { workspacesForCurrentUser } from '~/helpers/api-routes.js';

export default {
  name: 'WorkspaceList',
  data: () => ({
    workspacesIsLoading: true,
    workspaceIsError: false,
    workspaces: [],
  }),
  async mounted() {
    const { $axios } = this;

    try {
      this.workspacesIsLoading = true;
      const { items } = await $axios.$get(workspacesForCurrentUser());
      this.workspaces = items;
    } catch (error) {
      this.workspaceIsError = true;
    } finally {
      this.workspacesIsLoading = false;
    }
  },
};
</script>

<template>
  <v-skeleton-loader
    type="list-item, list-item, list-item"
    :loading="workspacesIsLoading"
  >
    <v-treeview
      ref="tree"
      item-key="id"
      :items="workspaces"
      activatable
      hoverable
      class="pb-8"
    >
      <template #prepend="{ item, open }">
        <v-icon v-if="!item.icon" :color="item.isAllowed ? 'primary' : 'base'">
          {{ open ? 'mdi-folder-open' : 'mdi-folder' }}
        </v-icon>
        <v-icon v-else :color="item.isAllowed ? 'primary' : 'base'">
          {{ item.icon }}
        </v-icon>
      </template>
      <template #label="{ item, active }">
        <div @click="active ? $event.stopPropagation() : null">
          {{ item.name }}
        </div>
      </template>
      <template #append="{ item }">
        <v-menu v-if="item.isAllowed" bottom left>
          <template #activator="{ on, attrs }">
            <v-btn icon v-bind="attrs" v-on="on">
              <v-icon color="primary">
                mdi-dots-vertical
              </v-icon>
            </v-btn>
          </template>
          <v-list>
            <v-list-item link to="#">
              <v-list-item-title>Éditer</v-list-item-title>
            </v-list-item>
            <v-list-item link to="#">
              <v-list-item-title>Déplacer</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </v-treeview>
  </v-skeleton-loader>
</template>

<style scoped>
.v-treeview-node--active,
.v-treeview--hoverable {
  cursor: pointer;
}

.v-treeview {
  overflow-y: auto;
  max-height: 450px;
}
</style>
