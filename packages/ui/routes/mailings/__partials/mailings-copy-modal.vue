<script>
import BsModalConfirm from '~/components/modal-confirm';
import destinationTreeMixin from '~/helpers/mixins/mixin-destination-tree';

export default {
  name: 'MailingsCopyModal',
  components: {
    BsModalConfirm,
  },
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
    :title="`${this.$t('global.copyMail')} <strong>${mailName}</strong>`"
    :is-form="true"
    class="modal-confirm-copy-mail"
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
