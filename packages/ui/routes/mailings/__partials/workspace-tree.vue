<script>
import { workspacesByGroup } from '~/helpers/api-routes.js';
import { getTreeviewWorkspaces } from '~/utils/workspaces';
import mixinCurrentLocation from '~/helpers/mixins/mixin-current-location';

export default {
  name: 'WorkspaceTree',
  mixins: [mixinCurrentLocation],
  data: () => ({
    workspacesIsLoading: true,
    workspaceIsError: false,
    workspaces: [],
  }),
  computed: {
    treeviewLocationItems() {
      return getTreeviewWorkspaces(this.workspaces);
    },
    selectedItem() {
      return this.currentLocation;
    },
  },
  async mounted() {
    const { $axios, $route } = this;
    try {
      this.workspacesIsLoading = true;
      await this.getFolderAndWorkspaceData($axios, $route.query);
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
      console.log(selectedItems[0]);
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
}
.v-treeview-node__label > div {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
</style>
