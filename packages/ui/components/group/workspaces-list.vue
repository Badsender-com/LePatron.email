<script>
import * as apiRoutes from '~/helpers/api-routes.js';

export default {
  name: 'BsGroupWorkspaceList',
  data: () => ({
    workspacesData: [],
    selection: [],
    loading: false,
  }),
  computed: {
    items() {
      return this.workspacesData.map((workspace) => {
        let formatedWorkspace = {
          icon: 'mdi-account-multiple-outline',
          id: workspace._id,
          name: workspace.name,
          isAllowed: workspace.hasRights,
        };

        if (workspace.folders?.length > 0) {
          formatedWorkspace = {
            children: workspace.folders.map((folder) =>
              this.recursiveFolderMap(folder, workspace.hasRights)
            ),
            ...formatedWorkspace,
          };
        }
        return formatedWorkspace;
      });
    },
  },
  watch: {
    selection(newValue) {
      this.handleSelectItemFromTreeView(newValue);
    },
  },
  async mounted() {
    const { $axios } = this;

    try {
      this.loading = true;
      const workspaceResponse = await $axios.$get(apiRoutes.workspacesGroup());
      this.workspacesData = workspaceResponse.items;
    } catch (error) {
      console.log(error);
    } finally {
      this.loading = false;
    }
  },
  methods: {
    recursiveFolderMap(folder, isAllowed) {
      let formatedData = {
        id: folder._id,
        name: folder.name,
        isAllowed,
      };
      if (folder.childFolders?.length > 0) {
        formatedData = {
          ...formatedData,
          children: folder.childFolders.map((child) =>
            this.recursiveFolderMap(child, isAllowed)
          ),
        };
      }
      return formatedData;
    },
    handleSelectItemFromTreeView(event) {
      console.log('call select item from tree view ');
      console.log(event);
      const iterator1 = this.selection.entries();
      console.log(iterator1.next().value);
      this.$emit('select-item');
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
      v-model="selection"
      :items="items"
      selection-type="independent"
      hoverable
      open-all
      activatable
      item-key="id"
      @update:active="handleSelectItemFromTreeView"
    >
      <template #prepend="{ item, open }">
        <v-icon
          v-if="!item.icon"
          :color="item.isAllowed ? 'primary' : 'base'"
        >
          {{ open ? 'mdi-folder-open' : 'mdi-folder' }}
        </v-icon>
        <v-icon
          v-else
          :color="item.isAllowed ? 'primary' : 'base'"
        >
          {{ item.icon }}
        </v-icon>
      </template>
      <template #append="{ item }">
        <v-menu
          v-if="item.isAllowed"
          bottom
          left
        >
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              v-bind="attrs"
              v-on="on"
            >
              <v-icon color="primary">
                mdi-dots-vertical
              </v-icon>
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
