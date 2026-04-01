<script>
import BsModalConfirm from '~/components/modal-confirm';
import { getTreeviewWorkspacesWithoutSubfolders } from '~/utils/workspaces';
import { SPACE_TYPE } from '~/helpers/constants/space-type';
import { mapState } from 'vuex';
import { FOLDER } from '~/store/folder';
import destinationTreeMixin from '~/helpers/mixins/mixin-destination-tree';
import { FolderOpen, Folder } from 'lucide-vue';

export default {
  name: 'FolderMoveModal',
  components: {
    BsModalConfirm,
    LucideFolderOpen: FolderOpen,
    LucideFolder: Folder,
  },
  mixins: [destinationTreeMixin],
  props: {
    confirmationInputLabel: { type: String, default: '' },
  },
  data() {
    return {
      folderToMove: null,
      workspaceIsError: false,
    };
  },
  computed: {
    ...mapState(FOLDER, ['workspacesHasRight']),
    treeviewLocationItems() {
      return getTreeviewWorkspacesWithoutSubfolders(this.workspacesHasRight);
    },
    isValidToBeMoved() {
      return (
        !!this.selectedLocation?.id &&
        this.selectedLocation?.id !== this.folderToMove?.id
      );
    },
    folderName() {
      return this.folderToMove?.name;
    },
  },
  methods: {
    submit() {
      if (this.isValidToBeMoved) {
        const location = this.selectedLocation;
        this.close();

        let destinationParam;
        if (location?.type === SPACE_TYPE.FOLDER) {
          destinationParam = {
            destinationFolderId: location?.id,
          };
        } else {
          destinationParam = {
            workspaceId: location?.id,
          };
        }
        this.$emit('confirm', {
          destinationParam,
          folderId: this.folderToMove?.id,
        });
      }
    },
    open(selectedFolder) {
      this.folderToMove = selectedFolder;
      this.$refs.moveFolderDialog.open();
      this.initDestinationTree();
    },
    close() {
      this.$refs.moveFolderDialog.close();
      this.resetDestination();
    },
  },
};
</script>
<template>
  <bs-modal-confirm
    ref="moveFolderDialog"
    :title="`${this.$t(
      'global.moveFolderAction'
    )} <strong>${folderName}</strong>`"
    :is-form="true"
    class="modal-confirm-move-mail"
    @click-outside="close"
  >
    <slot />
    <v-skeleton-loader
      type="list-item, list-item, list-item"
      :loading="areLoadingWorkspaces"
    >
      <v-treeview
        ref="tree"
        item-key="id"
        activatable
        :items="treeviewLocationItems"
        :open="openNodes"
        :active="activeNode"
        hoverable
        :dense="true"
        :return-object="true"
        class="pb-8"
        @update:active="handleSelectDestination"
      >
        <template #prepend="{ item, open }">
          <template v-if="!item.icon">
            <lucide-folder-open v-if="open" :size="18" style="color: var(--v-accent-base)" />
            <lucide-folder v-else :size="18" style="color: var(--v-accent-base)" />
          </template>
          <component v-else :is="item.iconComponent || 'lucide-folder'" :size="18" style="color: var(--v-accent-base)" />
        </template>
        <template #label="{ item, active }">
          <div @click="active ? $event.stopPropagation() : null">
            {{ item.name }}
          </div>
        </template>
      </v-treeview>
    </v-skeleton-loader>
    <v-divider />
    <v-card-actions>
      <v-spacer />
      <v-btn text @click="close">
        {{ $t('global.cancel') }}
      </v-btn>
      <v-btn
        :disabled="!isValidToBeMoved"
        elevation="0"
        color="accent"
        @click="submit"
      >
        {{ $t('global.move') }}
      </v-btn>
    </v-card-actions>
  </bs-modal-confirm>
</template>

<style scoped>
.v-treeview-node--active,
.v-treeview--hoverable {
  cursor: pointer;
}

.v-treeview {
  overflow-y: auto;
  max-height: 400px;
}
.v-treeview-node__label > div {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
</style>
