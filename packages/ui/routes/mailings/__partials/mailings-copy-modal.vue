<script>
import BsModalConfirm from '~/components/modal-confirm';
import destinationTreeMixin from '~/helpers/mixins/mixin-destination-tree';
import { FolderOpen, Folder, Users, Copy } from 'lucide-vue';
import { SPACE_TYPE } from '~/helpers/constants/space-type';
import { escapeHtml } from '~/helpers/escape-html';

export default {
  name: 'MailingsCopyModal',
  components: {
    BsModalConfirm,
    LucideFolderOpen: FolderOpen,
    LucideFolder: Folder,
    LucideUsers: Users,
    LucideCopy: Copy,
  },
  SPACE_TYPE,
  mixins: [destinationTreeMixin],
  props: {
    confirmationInputLabel: { type: String, default: '' },
  },
  data() {
    return {
      mail: null,
    };
  },
  computed: {
    isValidToBeCopied() {
      return !!this.selectedLocation?.id;
    },
    mailName() {
      return this.mail?.name;
    },
  },
  methods: {
    escapeHtml,
    submit() {
      if (this.isValidToBeCopied) {
        const location = this.selectedLocation;
        this.$emit('confirm', {
          selectedLocation: location,
          mailingId: this.mail?.id,
        });
        this.close();
      }
    },
    open(selectedMail) {
      this.mail = selectedMail;
      this.$refs.copyMailDialog.open();
      this.initDestinationTree();
    },
    close() {
      this.$refs.copyMailDialog.close();
      this.resetDestination();
    },
  },
};
</script>
<template>
  <bs-modal-confirm
    ref="copyMailDialog"
    :title="$t('global.copyMail')"
    :is-form="true"
    modal-width="clamp(500px, 60vw, 800px)"
    class="modal-confirm-copy-mail"
    @click-outside="close"
  >
    <template #titlePrefix>
      <lucide-copy :size="20" />
    </template>
    <p
      v-if="mailName"
      class="black--text"
      v-html="
        $t('mailings.copyMailConfirmationMessageWithName', {
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
        :disabled="!isValidToBeCopied"
        elevation="0"
        color="accent"
        @click="submit"
      >
        {{ $t('global.copyMailAction') }}
      </v-btn>
    </v-card-actions>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
/* Same destination-tree shell as the Dupliquer & traduire modal so all
   destination-picker actions share the visual pattern. */
.destination-tree {
  max-height: clamp(280px, 70vh, 720px);
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
