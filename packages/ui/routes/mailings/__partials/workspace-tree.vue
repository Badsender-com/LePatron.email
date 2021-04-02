<script>
import {
  getFolder,
  workspacesByGroup,
  deleteFolder,
} from '~/helpers/api-routes.js';
import { getTreeviewWorkspaces } from '~/utils/workspaces';
import mixinCurrentLocation from '~/helpers/mixins/mixin-current-location';
import FolderRenameModal from '~/routes/mailings/__partials/folder-rename-modal';
import { SPACE_TYPE } from '~/helpers/constants/space-type';
import BsModalConfirmForm from '~/components/modal-confirm-form';
import ModalMoveFolder from './modal-move-folder.vue';

export default {
  name: 'WorkspaceTree',
  components: { FolderRenameModal, BsModalConfirmForm, ModalMoveFolder },
  mixins: [mixinCurrentLocation],
  data: () => ({
    workspacesIsLoading: true,
    workspaceIsError: false,
    selectedItemToDelete: {},
    workspaces: [],
    conflictError: false,
  }),
  computed: {
    treeviewLocationItems() {
      return getTreeviewWorkspaces(this.workspaces);
    },
    selectedItem() {
      return { id: this.currentLocation };
    },
    confirmCheckBox() {
      return !!this.selectedItemToDelete?.children;
    },
    console: () => console,
  },
  async mounted() {
    await this.fetchData();
    if (!this.selectedItem?.id && this.workspaces?.length > 0) {
      await this.$router.push({
        query: { wid: this.workspaces[0]?.id },
      });
    }
  },
  methods: {
    async fetchData() {
      const { $axios, $route } = this;
      try {
        this.workspacesIsLoading = true;
        await this.getFolderAndWorkspaceData($axios, $route.query);
        const { items } = await $axios.$get(workspacesByGroup());
        this.workspaces = items;
      } catch (error) {
        this.workspaceIsError = true;
      } finally {
        this.workspacesIsLoading = false;
      }
    },
    checkIfAuthorizedMenu(item) {
      return item.hasAccess && item?.type === SPACE_TYPE.FOLDER;
    },
    handleSelectItemFromTreeView(selectedItems) {
      if (selectedItems[0]?.id) {
        let querySelectedElement = null;
        if (selectedItems[0]?.type === SPACE_TYPE.WORKSPACE) {
          querySelectedElement = {
            wid: selectedItems[0].id,
          };
        } else {
          querySelectedElement = {
            fid: selectedItems[0].id,
          };
        }
        this.$router.push({
          query: querySelectedElement,
        });
      }
    },
    displayDeleteModal(selected) {
      this.selectedItemToDelete = selected;
      this.$refs.deleteDialog.open({
        ...this.selectedItemToDelete,
      });
    },
    displayMoveModal(item) {
      this.$refs.moveModal.open(item);
    },
    async handleDelete(selected) {
      const { $axios } = this;
      const { id } = selected;
      this.$refs.deleteDialog.close();
      if (!id) return;
      this.loading = true;
      try {
        await $axios.$delete(deleteFolder(id));
        this.showSnackbar({
          text: this.$t('groups.mailingTab.deleteFolderSuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.log(error);
      } finally {
        this.loading = false;
        const deletingCurrent =
          this.selectedItemToDelete.id === this.selectedItem.id;
        const deletingParentOfCurrent = this.selectedItemToDelete.children?.some(
          (child) => child.id === this.selectedItem.id
        );
        if (deletingCurrent || deletingParentOfCurrent) {
          await this.$router.replace({
            query: { wid: this.workspaces[0]?.id },
          });
        }
        await this.fetchData();
      }
    },
    openRenameFolderModal(folder) {
      this.$refs.modalRenameFolderDialog.open(folder);
    },
    async handleRenameFolder({ folderName, folderId }) {
      try {
        await this.$axios.$patch(getFolder(folderId), {
          folderName: folderName,
        });
        await this.fetchData();
        this.conflictError = false;
        this.showSnackbar({
          text: this.$t('folders.nameUpdated'),
          color: 'success',
        });

        this.$refs.modalRenameFolderDialog.close();
      } catch (error) {
        if (error?.response?.status === 409) {
          this.conflictError = true;
        }
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
    onMoveFolder(param) {
      console.log({ param });
      this.$refs.moveModal.close();
    },
  },
};
</script>

<template>
  <v-skeleton-loader
    type="list-item, list-item, list-item"
    :loading="workspacesIsLoading"
  >
    {{ console.info({ treeviewLocationItems }) }}
    <v-treeview
      ref="tree"
      item-key="id"
      activatable
      :active="[selectedItem]"
      :items="treeviewLocationItems"
      hoverable
      open-all
      return-object
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
        <v-menu v-if="checkIfAuthorizedMenu(item)" offset-y>
          <template #activator="{ on }">
            <v-btn color="primary" dark icon v-on="on">
              <v-icon>mdi-dots-vertical</v-icon>
            </v-btn>
          </template>
          <v-list activable>
            <v-list-item nuxt @click="openRenameFolderModal(item)">
              <v-list-item-avatar>
                <v-btn color="primary" icon>
                  <v-icon>edit</v-icon>
                </v-btn>
              </v-list-item-avatar>
              <v-list-item-title>{{ $t('folders.rename') }} </v-list-item-title>
            </v-list-item>
            <v-list-item nuxt @click="displayDeleteModal(item)">
              <v-list-item-avatar>
                <v-btn color="primary" icon>
                  <v-icon>delete</v-icon>
                </v-btn>
              </v-list-item-avatar>
              <v-list-item-title>
                {{ $t('global.delete') }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item nuxt @click="displayMoveModal(item)">
              <v-list-item-avatar>
                <v-btn color="primary" icon>
                  <v-icon>drive_file_move</v-icon>
                </v-btn>
              </v-list-item-avatar>
              <v-list-item-title>
                {{ $t('global.move') }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </v-treeview>
    <bs-modal-confirm-form
      ref="deleteDialog"
      :with-input-confirmation="false"
      :confirm-check-box="confirmCheckBox"
      :confirm-check-box-message="$t('groups.mailingTab.deleteFolderNotice')"
      @confirm="handleDelete"
    >
      <p
        class="black--text"
        v-html="
          $t('groups.mailingTab.deleteFolderWarning', {
            name: selectedItemToDelete.name,
          })
        "
      />
    </bs-modal-confirm-form>
    <folder-rename-modal
      ref="modalRenameFolderDialog"
      :conflict-error="conflictError"
      :loading-parent="workspacesIsLoading"
      @rename-folder="handleRenameFolder"
    />
    <modal-move-folder ref="moveModal" @confirm="onMoveFolder">
      <p
        class="black--text"
        v-html="$t('folders.moveFolderConfirmationMessage')"
      />
    </modal-move-folder>
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
