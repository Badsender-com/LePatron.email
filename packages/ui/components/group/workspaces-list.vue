<script>
import * as apiRoutes from '~/helpers/api-routes.js';

export default {
  name: 'BsGroupWorkspaceList',
  data: () => ({
    workspacesData: [],
    tree: [],
    loading: false,
  }),
  computed: {
    items() {
      return this.workspacesData.map((workspace) => {
        let formatedWorkspace = {
          icon: 'mdi-account-multiple-outline',
          id: workspace._id,
          name: workspace.name,
        };

        if (workspace.folders?.length > 0) {
          formatedWorkspace = {
            children: workspace.folders.map((folder) =>
              this.recursiveFolderMap(folder)
            ),
            ...formatedWorkspace,
          };
        }
        return formatedWorkspace;
      });
    },
  },
  async mounted() {
    const { $axios } = this;

    try {
      this.loading = true;
      const workspaceResponse = await $axios.$get(apiRoutes.workspaces());
      this.workspacesData = workspaceResponse.items;
    } catch (error) {
      console.log(error);
    } finally {
      this.loading = false;
    }
  },
  methods: {
    recursiveFolderMap(folder) {
      let formatedData = {
        id: folder._id,
        name: folder.name,
      };
      if (folder.childFolders?.length > 0) {
        formatedData = {
          ...formatedData,
          children: folder.childFolders.map((child) =>
            this.recursiveFolderMap(child)
          ),
        };
      }
      return formatedData;
    },
  },
};
</script>

<template>
  <v-card
    class="mx-auto"
    width="300"
  >
    <v-subheader>{{ 'Workspaces' }}</v-subheader>
    <v-treeview
      v-model="tree"
      :items="items"
      hoverable
      open-all
      activatable
      item-key="name"
    >
      <template #prepend="{ item, open }">
        <v-icon v-if="!item.icon">
          {{ open ? 'mdi-folder-open' : 'mdi-folder' }}
        </v-icon>
        <v-icon v-else>
          {{ item.icon }}
        </v-icon>
      </template>
      <template #append>
        <v-menu
          bottom
          left
        >
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              v-bind="attrs"
              v-on="on"
            >
              <v-icon>mdi-dots-vertical</v-icon>
            </v-btn>
          </template>
          <v-list>
            <v-list-item
              link
              to="#"
            >
              <v-list-item-title>Éditer</v-list-item-title>
            </v-list-item>
            <v-list-item
              link
              to="#"
            >
              <v-list-item-title>Déplacer</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </v-treeview>
  </v-card>
</template>
<style>
.v-treeview-node--active,
.v-treeview--hoverable {
  cursor: pointer;
}
</style>
