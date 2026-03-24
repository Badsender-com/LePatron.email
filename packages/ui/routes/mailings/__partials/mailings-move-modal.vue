<script>
import BsModalConfirm from '~/components/modal-confirm';
import { SPACE_TYPE } from '~/helpers/constants/space-type';
import destinationTreeMixin from '~/helpers/mixins/mixin-destination-tree';

export default {
  name: 'MailingsMoveModal',
  components: {
    BsModalConfirm,
  },
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
    :title="`${this.$t('global.moveMail')} <strong>${mailName}</strong>`"
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
        :items="treeviewWorkspacesHasRight"
        :open="openNodes"
        :active="activeNode"
        hoverable
        :dense="true"
        :return-object="true"
        class="pb-8"
        @update:active="handleSelectDestination"
      >
        <template #prepend="{ item, open }">
          <v-icon v-if="!item.icon" color="accent">
            {{ open ? 'mdi-folder-open' : 'mdi-folder' }}
          </v-icon>
          <v-icon v-else color="accent">
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
