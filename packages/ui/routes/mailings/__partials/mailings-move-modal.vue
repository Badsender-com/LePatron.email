<script>
import BsModalConfirm from '~/components/modal-confirm';
import { workspacesByGroup } from '~/helpers/api-routes';
import { getTreeviewWorkspaces } from '~/utils/workspaces';

export default {
  name: 'ModalMoveMail',
  components: {
    BsModalConfirm,
  },
  props: {
    confirmationInputLabel: { type: String, default: '' },
    confirmationTitleLabel: { type: String, default: '' },
    isMovingManyMails: { type: Boolean, default: false },
  },
  data() {
    return {
      mail: null,
      currentWorkspace: null,
      workspaces: [],
      workspaceIsError: false,
      workspacesIsLoading: false,
      selectedLocation: {},
    };
  },
  computed: {
    treeviewLocationItems() {
      return getTreeviewWorkspaces(this.workspaces);
    },
    isValidToBeMoved() {
      return (
        !!this.selectedLocation?.id &&
        this.selectedLocation?.id !== this.currentWorkspace?.id
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
    async fetchWorkspaces() {
      const { $axios } = this;
      try {
        this.workspacesIsLoading = true;
        const { items } = await $axios.$get(workspacesByGroup());
        this.workspaces = items?.filter((workspace) => workspace?.hasRights);
      } catch (error) {
        this.workspaceIsError = true;
      } finally {
        this.workspacesIsLoading = false;
      }
    },
    submit() {
      if (this.isValidToBeMoved) {
        this.close();
        this.$emit('confirm', {
          destinationWorkspaceId: this.selectedLocation?.id,
          mailingId: this.mail?.id,
        });
      }
    },
    handleSelectItemFromTreeView(selectedItems) {
      if (selectedItems[0]) {
        this.selectedLocation = selectedItems[0];
      }
    },
    open(selectedMail) {
      this.fetchWorkspaces();
      this.mail = selectedMail.mail;
      this.currentWorkspace = selectedMail.workspace;
      this.$refs.moveMailDialog.open();
    },
    close() {
      this.$refs.moveMailDialog.close();
    },
  },
};
</script>
<template>
  <bs-modal-confirm
    ref="moveMailDialog"
    :title="`${confirmationTitleLabel} ${mailName}`"
    :is-form="true"
    class="modal-confirm-move-mail"
  >
    <slot />
    <v-skeleton-loader
      type="list-item, list-item, list-item"
      :loading="workspacesIsLoading"
    >
      <v-treeview
        ref="tree"
        item-key="id"
        activatable
        :items="treeviewLocationItems"
        hoverable
        open-all
        :dense="true"
        :return-object="true"
        class="pb-8"
        @update:active="handleSelectItemFromTreeView"
      >
        <template #prepend="{ item, open }">
          <v-icon v-if="!item.icon" color="primary">
            {{ open ? 'mdi-folder-open' : 'mdi-folder' }}
          </v-icon>
          <v-icon v-else color="primary">
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
      <v-btn color="primary" text @click="close">
        {{ $t('global.cancel') }}
      </v-btn>
      <v-btn :disabled="!isValidToBeMoved" color="primary" @click="submit">
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
}
.v-treeview-node__label > div {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
</style>
