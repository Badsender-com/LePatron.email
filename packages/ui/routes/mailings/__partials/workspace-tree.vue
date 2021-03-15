<script>
import { workspacesByGroup } from '~/helpers/api-routes.js';
import { recursiveFolderMap } from '../../../utils/folders';
import { WORKSPACE } from '../../../../server/constant/space-type';

export default {
  name: 'WorkspaceTree',
  props: {
    selectedItem: {
      type: String,
      default: '',
    },
  },
  data: () => ({
    workspacesIsLoading: true,
    workspaceIsError: false,
    workspaces: [],
  }),
  computed: {
    treeviewLocationItems() {
      return this.workspaces.map((workspace) => {
        const path = {
          name: workspace.name,
          id: workspace._id,
          type: WORKSPACE,
        };

        let formatedWorkspace = {
          icon: 'mdi-account-multiple-outline',
          id: workspace._id,
          name: workspace.name,
          isAllowed: workspace.hasRights,
          type: WORKSPACE,
          path,
        };

        if (workspace.folders?.length > 0) {
          formatedWorkspace = {
            children: workspace.folders.map((folder) =>
              recursiveFolderMap(folder, workspace.hasRights, path)
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
      this.workspacesIsLoading = true;
      const { items } = await $axios.$get(workspacesByGroup());
      console.log({ items });
      if (!this.selectedItem && items.length > 0) {
        await this.$router.push({
          query: { wid: items[0]?.id },
        });
      }
      this.workspaces = items;
    } catch (error) {
      this.workspaceIsError = true;
    } finally {
      this.workspacesIsLoading = false;
    }
  },
  methods: {
    handleSelectItemFromTreeView(selectedItems) {
      if (selectedItems[0]) {
        const querySelectedElement = {
          wid: selectedItems[0],
        };
        this.$router.push({
          query: querySelectedElement,
        });
      }
    },
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
      activatable
      :active="[selectedItem]"
      :items="treeviewLocationItems"
      hoverable
      open-all
      class="pb-8"
      @update:active="handleSelectItemFromTreeView"
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
