<script>
import BsModalConfirm from '~/components/modal-confirm';
import { SPACE_TYPE } from '~/helpers/constants/space-type';
import destinationTreeMixin from '~/helpers/mixins/mixin-destination-tree';
import { FolderOpen, Folder, Users, Move } from 'lucide-vue';
import { escapeHtml } from '~/helpers/escape-html';

export default {
  name: 'MailingsMoveModal',
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
    confirmationTitleLabel: { type: String, default: '' },
    isMovingManyMails: { type: Boolean, default: false },
  },
  data() {
    return {
      mail: null,
      currentLocation: null,
    };
  },
  computed: {
    isValidToBeMoved() {
      return (
        !!this.selectedLocation?.id &&
        this.selectedLocation?.id !== this.currentLocation
      );
    },
    mailName() {
      return !this.isMovingManyMails ? this.mail?.name : '';
    },
    moveLabelButton() {
      return !this.isMovingManyMails
        ? this.$t('global.moveMail')
        : this.$t('global.moveManyMail');
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
            parentFolderId: location?.id,
          };
        } else {
          destinationParam = {
            workspaceId: location?.id,
          };
        }
        this.$emit('confirm', {
          destinationParam,
          mailingId: this.mail?.id,
        });
      }
    },
    open(selectedMail) {
      this.mail = selectedMail.mail;
      this.currentLocation = selectedMail.location;
      this.$refs.moveMailDialog.open();
      this.initDestinationTree();
    },
    close() {
      this.$refs.moveMailDialog.close();
      this.resetDestination();
    },
  },
};
</script>
<template>
  <bs-modal-confirm
    ref="moveMailDialog"
    :title="moveLabelButton"
    :is-form="true"
    modal-width="650"
    class="modal-confirm-move-mail"
    @click-outside="close"
  >
    <template #titlePrefix>
      <lucide-move :size="20" />
    </template>
    <p
      v-if="mailName"
      class="black--text"
      v-html="
        $t('mailings.moveMailConfirmationMessageWithName', {
          name: escapeHtml(mailName),
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
          :items="treeviewWorkspacesHasRight"
          :open="openNodes"
          :active="activeNode"
          :load-children="loadDestinationChildren"
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
        {{ moveLabelButton }}
      </v-btn>
    </v-card-actions>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
/* Same destination-tree shell as the Dupliquer & traduire modal so both
   actions share the visual pattern. */
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
