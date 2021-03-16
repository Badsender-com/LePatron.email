<script>
import { workspacesByGroup } from '~/helpers/api-routes.js';
import { getTreeviewWorkspaces } from '~/utils/workspaces';

export default {
  name: 'WorkspaceTree',
  data: () => ({
    workspacesIsLoading: true,
    workspaceIsError: false,
    workspaces: [],
    selectedItem: '',
  }),
  computed: {
    treeviewLocationItems() {
      return getTreeviewWorkspaces(this.workspaces);
    },
  },
  watch: {
    // call again the method if the route changes
    $route: 'setSelectedItem',
  },
  async mounted() {
    const { $axios } = this;
    try {
      this.workspacesIsLoading = true;
      const { items } = await $axios.$get(workspacesByGroup());
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
    setSelectedItem() {
      this.selectedItem = this.$route.query?.wid;
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
        <v-icon v-if="!item.icon" :color="item.hasAccess ? 'primary' : 'base'">
          {{ open ? 'mdi-folder-open' : 'mdi-folder' }}
        </v-icon>
        <v-icon v-else :color="item.hasAccess ? 'primary' : 'base'">
          {{ item.icon }}
        </v-icon>
      </template>
      <template #label="{ item, active }">
        <div @click="active ? $event.stopPropagation() : null">
          {{ item.name }}
        </div>
      </template>
      <template #append="{ item }">
        <v-menu v-if="item.hasAccess" bottom left>
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
.v-treeview-node__label > div {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
</style>
