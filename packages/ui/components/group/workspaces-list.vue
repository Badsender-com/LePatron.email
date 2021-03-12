<script>
import { WORKSPACE } from '../../../server/constant/space-type';
import { workspacesByGroup } from '~/helpers/api-routes';
import { recursiveFolderMap } from '../../utils/folders';
export default {
  name: 'WorkspaceList',
  props: {
    selectedWorkspace: { type: Object, default: () => ({}) },
    setParentComponentWorkspaceData: { type: Function, default: () => {} },
  },
  data() {
    return {
      workspacesIsLoading: false,
      workspaceIsError: false,
      workspaces: [],
    };
  },
  computed: {
    selectedWorkspaceId() {
      return this.selectedWorkspace?.id;
    },
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
      this.workspaces = items;
      this.setParentComponentWorkspaceData(items);
    } catch (error) {
      this.workspaceIsError = true;
    } finally {
      this.workspacesIsLoading = false;
    }
  },
  methods: {
    handleLocationSelectionFromTreeview(event) {
      let selectedElement = null;
      let querySelectedElement = null;
      if (!event[0]) {
        selectedElement = this.selectedWorkspace;
        querySelectedElement = {
          id: this.selectedWorkspace?.id,
          type: this.selectedWorkspace?.type,
        };
      } else {
        selectedElement = event[0];
        querySelectedElement = {
          id: selectedElement?.id,
          type: selectedElement?.type,
        };
      }

      if (
        JSON.stringify(this.$route.query) !==
        JSON.stringify(querySelectedElement)
      ) {
        this.$router.replace({
          query: querySelectedElement,
        });
      }

      this.$emit('active-list-item', selectedElement);
    },
  },
};
</script>

<template>
  <v-card class="mx-auto" width="300">
    <v-skeleton-loader
      type="list-item, list-item, list-item"
      :loading="workspacesIsLoading"
    >
      <v-subheader>{{ 'Workspaces' }}</v-subheader>
      <v-treeview
        activatable
        hoverable
        :items="treeviewLocationItems"
        :open-all="true"
        :active="[{ id: selectedWorkspaceId }]"
        :return-object="true"
        class="pb-8"
        item-key="id"
        @update:active="handleLocationSelectionFromTreeview"
      >
        <template #prepend="{ item, open }">
          <v-icon
            v-if="!item.icon"
            :color="item.isAllowed ? 'primary' : 'base'"
          >
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
