### Objectif

### API

Deelan is working on a API in the moment of the writing of this conception, the API expected is

```
POST /mailings/:mailingId/copy

Body {
mailingId : String // id of mail to copy,
workspaceId : String // id of destination workspace
}
```

### Front

- Add a component, ModalCopyMail, contain

```
<script>
import BsModalConfirm from '~/components/modal-confirm';
import { workspacesByGroup } from '~/helpers/api-routes';
import { getTreeviewWorkspaces } from '~/utils/workspaces';

export default {
  name: 'ModalCopyMail',
  components: {
    BsModalConfirm,
  },
  props: {
    confirmationInputLabel: { type: String, default: '' },
  },
  data() {
    return {
      mail: null,
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
    valid() {
      return !!this.selectedLocation?.id;
    },
  },
  async mounted() {
    const { $axios } = this;
    try {
      this.workspacesIsLoading = true;
      const { items } = await $axios.$get(workspacesByGroup());
      this.workspaces = items;
    } catch (error) {
      this.workspaceIsError = true;
    } finally {
      this.workspacesIsLoading = false;
    }
  },
  methods: {
    submit() {
      if (this.valid) {
        this.close();
        this.$emit('confirm', this.data);
      }
    },
    handleSelectItemFromTreeView(selectedItems) {
      if (selectedItems[0]) {
        this.selectedLocation = selectedItems[0]
      }
    },
    open(selectedMail) {
      this.mail = selectedMail;
      this.$refs.copyMailDialog.open();
    },
    close() {
      this.$refs.form.reset();
      this.$refs.copyMailDialog.close();
    },
  },
};
</script>
<template>
  <bs-modal-confirm
    ref="copyMailDialog"
    :title="`${this.$t('global.copyMailTitle')} ${selectedMail.name}`"
    :is-form="true"
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
      <v-btn color="error" @click="submit">
        {{ $t('global.copyMail') }}
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

```

- Add column copy action to the mail table
- Add modal implementation.

```
<modal-copy-mail
          ref="copyMailDialog"
          :title="`${$t('global.copyMail')} ?`"
          :action-label="$t('global.copyMail')"
          :confirmation-input-label="
            $t('mailing.copyMailConfirmation')
          "
         @confirm="copyMail"
        >
          <p
            class="black--text"
            v-html="
              $t('mailing.copyMailConfirmationMessage')
            "
          />
        </bs-modal-confirm-form>

```

- Add `copyMail` method that is going to make the api for copying the mail

```
async copyMail({ selectedWorkspace, mailingId }) {
      try {
        await this.$axios.post(copyMail(), {
          mailingId: mailingId,
          workspaceId: selectedWorkspace
        });
        this.showSnackbar({
          text: this.$t('mailing.copyMailSuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
      this.closeCopyMail();
    },

```
