<script>
import { spaceType } from '~/helpers/constants/spaceType.js';

export default {
  name: 'BsGroupWorkspaceList',
  props: {
    defaultItem: { type: Object, default: () => ({}) },
    workspacesData: { type: Array, default: () => [] },
  },
  data() {
    return {
      search: null,
    };
  },
  computed: {
    filter() {
      return (item, search, textKey) => item[textKey].indexOf(search) > -1;
    },
    defaultItemId() {
      return this.defaultItem?.id;
    },
    items() {
      return this.workspacesData.map((workspace) => {
        const path = {
          name: workspace.name,
          id: workspace._id,
          type: spaceType.WORKSPACE,
        };
        let formatedWorkspace = {
          icon: 'mdi-account-multiple-outline',
          id: workspace._id,
          name: workspace.name,
          isAllowed: workspace.hasRights,
          type: spaceType.WORKSPACE,
          path,
        };

        if (workspace.folders?.length > 0) {
          formatedWorkspace = {
            children: workspace.folders.map((folder) =>
              this.recursiveFolderMap(folder, workspace.hasRights, path)
            ),
            ...formatedWorkspace,
          };
        }
        return formatedWorkspace;
      });
    },
  },
  methods: {
    recursiveFolderMap(folder, isAllowed, parentPath) {
      const path = this.recursivePath(
        {
          id: folder.id,
          name: folder.name,
          type: spaceType.FOLDER,
        },
        parentPath
      );

      let formatedData = {
        id: folder._id,
        name: folder.name,
        isAllowed,
        type: spaceType.FOLDER,
        path,
      };
      if (folder.childFolders?.length > 0) {
        formatedData = {
          ...formatedData,
          children: folder.childFolders.map((child) =>
            this.recursiveFolderMap(child, isAllowed, path)
          ),
        };
      }
      return formatedData;
    },
    recursivePath(childPath, parentPath) {
      if (parentPath?.pathChild) {
        return {
          ...parentPath,
          pathChild: this.recursivePath(childPath, parentPath.pathChild),
        };
      } else {
        return {
          ...parentPath,
          pathChild: childPath,
        };
      }
    },
    handleSelectItemFromTreeView(event) {
      let selectedElement = null;
      let querySelectedElement = null;
      if (!event[0]) {
        selectedElement = this.defaultItem;
        querySelectedElement = {
          id: this.defaultItem?.id,
          type: this.defaultItem?.type,
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
    handleSearch(input) {
      if (input) {
        this.$refs.tree.updateAll(true);
      }
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
    <v-sheet class="pa-4 secondary">
      <v-text-field
        v-model="search"
        :label="$t('global.searchLabel')"
        dark
        flat
        solo-inverted
        hide-details
        clearable
        clear-icon="mdi-close-circle-outline"
        @input="handleSearch"
      />
    </v-sheet>
    <v-treeview
      ref="tree"
      open-all
      :items="items"
      activatable
      :search="search"
      :filter="filter"
      hoverable
      :active="[{ id: defaultItemId }]"
      :return-object="true"
      class="pb-8"
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
      <template #label="{ item, active }">
        <div @click="active ? $event.stopPropagation() : null">
          {{ item.name }}
        </div>
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
