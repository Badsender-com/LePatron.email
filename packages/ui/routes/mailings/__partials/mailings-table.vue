<script>
import { mapMutations, mapGetters } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { USER, IS_ADMIN } from '~/store/user.js';
import ModalCopyMail from '~/routes/mailings/__partials/modal-copy-mail';

import { mailingsItem, copyMail } from '~/helpers/api-routes.js';
import BsMailingsModalRename from '~/components/mailings/modal-rename.vue';
import BsModalConfirmForm from '~/components/modal-confirm-form';

const TABLE_HIDDEN_COLUMNS_ADMIN = ['userName', 'actionCopyMail'];
const TABLE_HIDDEN_COLUMNS_USER = ['actionTransfer'];
const TABLE_HIDDEN_COLUMNS_NO_ACCESS = [
  'actionRename',
  'actionDuplicate',
  'actionDelete',
];

export default {
  name: 'MailingsTable',
  components: {
    BsMailingsModalRename,
    BsModalConfirmForm,
    ModalCopyMail,
  },
  model: { prop: 'mailingsSelection', event: 'input' },
  props: {
    mailings: { type: Array, default: () => [] },
    workspace: { type: Object, default: () => {} },
    mailingsSelection: { type: Array, default: () => [] },
  },
  data() {
    return {
      loading: false,
      dialogRename: false,
      selectedMailing: {},
    };
  },
  computed: {
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    hiddenCols() {
      const excludedRules = this.isAdmin
        ? TABLE_HIDDEN_COLUMNS_ADMIN
        : TABLE_HIDDEN_COLUMNS_USER;
      if (!this.workspace.hasAccess) {
        return [...excludedRules, ...TABLE_HIDDEN_COLUMNS_NO_ACCESS];
      }
      return excludedRules.filter(
        (rule) => !TABLE_HIDDEN_COLUMNS_NO_ACCESS.includes(rule)
      );
    },
    selectedRows: {
      get() {
        return this.mailingsSelection;
      },
      set(newSelection) {
        this.$emit('input', newSelection);
      },
    },
    tablesHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        { text: this.$t('global.author'), align: 'left', value: 'userName' },
        {
          text: this.$tc('global.template', 1),
          align: 'left',
          value: 'templateName',
        },
        {
          text: this.$t('global.tags'),
          align: 'left',
          value: 'tags',
          sortable: false,
        },
        { text: this.$t('global.createdAt'), value: 'createdAt' },
        { text: this.$t('global.updatedAt'), value: 'updatedAt' },
        {
          text: this.$t('tableHeaders.mailings.rename'),
          value: 'actionRename',
          align: 'center',
          class: 'table-column-action',
          sortable: false,
        },
        {
          text: this.$t('tableHeaders.mailings.transfer'),
          value: 'actionTransfer',
          align: 'center',
          class: 'table-column-action',
          sortable: false,
        },
        {
          text: this.$t('global.duplicate'),
          value: 'actionDuplicate',
          align: 'center',
          class: 'table-column-action',
          sortable: false,
        },
        {
          text: this.$t('global.delete'),
          value: 'actionDelete',
          align: 'center',
          class: 'table-column-action',
          sortable: false,
        },
        {
          text: this.$t('global.copyMail'),
          value: 'actionCopyMail',
          align: 'center',
          class: 'table-column-action',
          sortable: false,
        },
      ].filter((column) => !this.hiddenCols.includes(column.value));
    },
    tableOptions() {
      return {
        sortBy: ['updatedAt'],
        sortDesc: [true],
      };
    },
  },
  watch: {
    dialogRename(val) {
      val || this.closeRename();
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    openRenameModal(mailing) {
      this.$refs.renameDialog.open({
        newName: mailing.name,
        mailingId: mailing.id,
      });
    },
    displayDeleteModal(mailing) {
      this.selectedMailing = mailing;
      this.$refs.deleteDialog.open({
        name: mailing.name,
        id: mailing.id,
      });
    },
    closeRename() {
      this.$refs.renameDialog.close();
    },
    openCopyMail(mailing) {
      this.$refs.copyMailDialog.open({
        name: mailing.name,
        id: mailing.id,
      });
    },
    closeCopyMailDialog() {
      this.$refs.copyMailDialog.close();
    },
    closeDelete() {
      this.$refs.deleteDialog.close();
    },
    async updateName(renameModalInfo) {
      const { $axios } = this;
      const { newName, mailingId } = renameModalInfo;
      this.closeRename();
      if (!mailingId) return;
      this.loading = true;
      const updateUri = mailingsItem({ mailingId });
      try {
        await $axios.$patch(updateUri, {
          name: newName,
          workspaceId: this.$route.query.wid,
        });
        this.$emit('on-refetch');
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
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
      }
    },
    async handleDelete(mailing) {
      const { $axios } = this;
      const { id } = mailing;
      this.closeDelete();
      if (!id) return;
      this.loading = true;
      const updateUri = mailingsItem({ mailingId: id });
      try {
        await $axios.$delete(updateUri, {
          data: {
            workspaceId: this.$route.query.wid,
          },
        });
        this.$emit('on-refetch');
        this.showSnackbar({
          text: this.$t('snackbars.deleted'),
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
      }
    },
    async copyMail({ workspaceId, mailingId }) {
      try {
        await this.$axios.$post(copyMail(), {
          mailingId,
          workspaceId,
        });
        if (workspaceId === this.workspace?.id) {
          this.$emit('on-refetch');
        } else {
          this.$router.push({
            query: { wid: workspaceId },
          });
        }

        this.showSnackbar({
          text: this.$t('mailings.copyMailSuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
      this.closeCopyMailDialog();
    },
    transferMailing(mailing) {
      this.$emit('transfer', mailing);
    },
    duplicateMailing(mailing) {
      this.$emit('duplicate', mailing);
    },
    display(mailing) {
      this.$emit('copyMail', mailing);
    },
  },
};
</script>

<template>
  <div>
    <v-data-table
      v-model="selectedRows"
      :headers="tablesHeaders"
      :options="tableOptions"
      :items="mailings"
      show-select
    >
      <template #item.name="{ item }">
        <a :href="`/editor/${item.id}`">{{ item.name }}</a>
      </template>
      <template #item.userName="{ item }">
        <nuxt-link v-if="isAdmin" :to="`/users/${item.userId}`">
          {{ item.userName }}
        </nuxt-link>
        <span v-else>{{ item.userName }}</span>
      </template>
      <template #item.templateName="{ item }">
        <nuxt-link v-if="isAdmin" :to="`/templates/${item.templateId}`">
          {{ item.templateName }}
        </nuxt-link>
        <span v-else>{{ item.templateName }}</span>
      </template>
      <template #item.tags="{ item }">
        <span>{{ item.tags.join(`, `) }}</span>
      </template>
      <template #item.createdAt="{ item }">
        <span>{{ item.createdAt | preciseDateTime }}</span>
      </template>
      <template #item.updatedAt="{ item }">
        <span>{{ item.updatedAt | preciseDateTime }}</span>
      </template>
      <template #item.actionRename="{ item }">
        <v-btn
          :disabled="loading"
          icon
          color="primary"
          @click="openRenameModal(item)"
        >
          <v-icon>title</v-icon>
        </v-btn>
      </template>
      <template #item.actionTransfer="{ item }">
        <v-btn
          :disabled="loading"
          icon
          color="primary"
          @click="transferMailing(item)"
        >
          <v-icon>forward</v-icon>
        </v-btn>
      </template>
      <template #item.actionDuplicate="{ item }">
        <v-btn
          :disabled="loading"
          icon
          color="primary"
          @click="duplicateMailing(item)"
        >
          <v-icon>content_paste</v-icon>
        </v-btn>
      </template>
      <template #item.actionCopyMail="{ item }">
        <v-btn
          :disabled="loading"
          icon
          color="primary"
          @click="openCopyMail(item)"
        >
          <v-icon>content_copy</v-icon>
        </v-btn>
      </template>
      <template #item.actionDelete="{ item }">
        <v-btn
          :disabled="loading"
          icon
          color="primary"
          @click="displayDeleteModal(item)"
        >
          <v-icon>delete</v-icon>
        </v-btn>
      </template>
    </v-data-table>
    <bs-mailings-modal-rename ref="renameDialog" @update="updateName" />
    <bs-modal-confirm-form
      ref="deleteDialog"
      :confirmation-input-label="$t('groups.mailingTab.confirmationField')"
      @confirm="handleDelete"
    >
      <p
        class="black--text"
        v-html="
          $t('groups.mailingTab.deleteWarningMessage', {
            name: selectedMailing.name,
          })
        "
      />
    </bs-modal-confirm-form>
    <modal-copy-mail ref="copyMailDialog" @confirm="copyMail">
      <p
        class="black--text"
        v-html="$t('mailings.copyMailConfirmationMessage')"
      />
    </modal-copy-mail>
  </div>
</template>
