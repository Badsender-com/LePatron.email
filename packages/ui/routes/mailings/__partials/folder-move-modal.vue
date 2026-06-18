<script>
import BsModalConfirm from '~/components/modal-confirm';
import { getTreeviewWorkspacesWithoutSubfolders } from '~/utils/workspaces';
import { SPACE_TYPE } from '~/helpers/constants/space-type';
import { mapState } from 'vuex';
import { FOLDER } from '~/store/folder';
import destinationTreeMixin from '~/helpers/mixins/mixin-destination-tree';
import { FolderOpen, Folder, Users, Move } from 'lucide-vue';
import { escapeHtml } from '~/helpers/escape-html';

export default {
  name: 'FolderMoveModal',
  components: {
    BsModalConfirm,
    LucideFolderOpen: FolderOpen,
    LucideFolder: Folder,
    LucideUsers: Users,
    LucideMove: Move,
  },
  SPACE_TYPE,
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
    escapeHtml,
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
    :title="$t('global.moveFolderAction')"
    :is-form="true"
    modal-width="650"
    class="modal-confirm-move-mail"
    @click-outside="close"
  >
    <template #titlePrefix>
      <lucide-move :size="20" />
    </template>
    <p
      v-if="folderName"
      class="black--text"
      v-html="
        $t('folders.moveFolderConfirmationMessageWithName', {
          name: escapeHtml(folderName),
        })
      "
    />
    <slot v-else />
    <v-skeleton-loader
      type="list-item, list-item, list-item"
      :loading="areLoadingWorkspaces"
    >
      <div class="destination-tree">
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
          @update:active="handleSelectDestination"
        >
          <template #prepend="{ item, active }">
            <!-- Workspace icon -->
            <lucide-users
              v-if="item.type === $options.SPACE_TYPE.WORKSPACE"
              :size="18"
              :class="['tree-icon', { 'tree-icon--active': active }]"
            />
            <!-- Folder icons -->
            <template v-else>
              <lucide-folder-open
                v-if="active"
                :size="18"
                class="tree-icon tree-icon--active"
              />
              <lucide-folder v-else :size="18" class="tree-icon" />
            </template>
          </template>
          <template #label="{ item, active }">
            <div @click="active ? $event.stopPropagation() : null">
              {{ item.name }}
            </div>
          </template>
        </v-treeview>
      </div>
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

<style lang="scss" scoped>
/* Same destination-tree shell as the Dupliquer & traduire modal so all
   destination-picker actions share the visual pattern. */
.destination-tree {
  max-height: 50vh;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;

  ::v-deep .v-treeview-node--active {
    cursor: pointer;
  }

  ::v-deep .v-treeview-node__label > div {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }
}

.v-treeview-node--active,
.v-treeview--hoverable {
  cursor: pointer;
}

/* Tree icon color states and alignment - aligned with sidebar */
.tree-icon {
  color: rgba(0, 0, 0, 0.54);
  transition: color 0.15s ease;
  vertical-align: middle;

  &--active {
    color: var(--v-accent-base);
  }
}
</style>
