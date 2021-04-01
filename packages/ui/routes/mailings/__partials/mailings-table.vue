<script>
import { mapMutations, mapGetters } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { USER, IS_ADMIN } from '~/store/user.js';
import ModalCopyMail from '~/routes/mailings/__partials/mailings-copy-modal';
import ModalMoveMail from '~/routes/mailings/__partials/mailings-move-modal';

import mixinCurrentLocation from '~/helpers/mixins/mixin-current-location';

import { mailingsItem, copyMail, moveMail } from '~/helpers/api-routes.js';
import BsMailingsModalRename from '~/components/mailings/modal-rename.vue';
import BsModalConfirmForm from '~/components/modal-confirm-form';
import BsMailingsActionsDropdown from './mailings-actions-dropdown';
import BsMailingsActionsDropdownItem from './mailings-actions-dropdown-item';
import MailingsTagsMenu from './mailings-tags-menu';

import { ACTIONS, ACTIONS_DETAILS } from '~/helpers/constants/mails';

const COLUMN_USERNAME = 'userName';
const TABLE_HIDDEN_COLUMNS_ADMIN = [COLUMN_USERNAME, ACTIONS.COPY_MAIL];
const TABLE_HIDDEN_COLUMNS_USER = [ACTIONS.TRANSFER];
const TABLE_HIDDEN_COLUMNS_NO_ACCESS = [
  ACTIONS.RENAME,
  ACTIONS.DELETE,
  ACTIONS.ADD_TAGS,
  ACTIONS.MOVE_MAIL,
];

const TABLE_ACTIONS = [
  ACTIONS.RENAME,
  ACTIONS.TRANSFER,
  ACTIONS.ADD_TAGS,
  ACTIONS.DELETE,
  ACTIONS.COPY_MAIL,
  ACTIONS.MOVE_MAIL,
  'actionMoveMail',
];

export default {
  name: 'MailingsTable',
  components: {
    BsMailingsModalRename,
    BsModalConfirmForm,
    ModalCopyMail,
    BsMailingsActionsDropdown,
    BsMailingsActionsDropdownItem,
    MailingsTagsMenu,
    ModalMoveMail,
  },
  mixins: [mixinCurrentLocation],
  model: { prop: 'mailingsSelection', event: 'input' },
  props: {
    mailings: { type: Array, default: () => [] },
    mailingsSelection: { type: Array, default: () => [] },
    tags: { type: Array, default: () => [] },
  },
  data() {
    return {
      loading: false,
      dialogRename: false,
      selectedMailing: {},
      tableActions: TABLE_ACTIONS,
      actions: ACTIONS,
      actionsDetails: ACTIONS_DETAILS,
    };
  },
  async mounted() {
    await this.getFolderAndWorkspaceData(this.$axios, this.$route);
  },
  computed: {
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    hiddenCols() {
      const excludedRules = this.isAdmin
        ? TABLE_HIDDEN_COLUMNS_ADMIN
        : TABLE_HIDDEN_COLUMNS_USER;
      if (!this.hasAccess) {
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
          text: this.$t('global.actions'),
          value: 'actions',
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
    filteredActions() {
      return this.tableActions.filter(
        (action) => !this.hiddenCols.includes(action)
      );
    },
    selectedMailTags() {
      return this.selectedMailing?.tags || [];
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
    openTagsMenu(mailing) {
      this.selectedMailing = mailing;
      this.$refs.addTagsMenu.openMenu({
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
    openMoveMail(mailing) {
      this.$refs.moveMailDialog.open({
        mail: {
          name: mailing.name,
          id: mailing.id,
        },
        location: this.currentLocation,
      });
    },
    closeCopyMailDialog() {
      this.$refs.copyMailDialog.close();
    },
    closeMoveMailDialog() {
      this.$refs.moveMailDialog.close();
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
    async moveMail({ destinationParam, mailingId }) {
      try {
        await this.$axios.$post(
          moveMail({
            mailingId,
          }),
          {
            mailingId,
            ...destinationParam,
          }
        );

        let routerRedirectionParam;
        if (destinationParam?.parentFolderId) {
          routerRedirectionParam = { fid: destinationParam?.parentFolderId };
        } else {
          routerRedirectionParam = { wid: destinationParam?.workspaceId };
        }

        await this.$router.push({
          query: routerRedirectionParam,
        });
        this.showSnackbar({
          text: this.$t('mailings.moveMailSuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
      this.closeMoveMailDialog();
    },
    transferMailing(mailing) {
      this.$emit('transfer', mailing);
    },
    display(mailing) {
      this.$emit('copyMail', mailing);
    },
    updateTags(tags) {
      this.$emit('update-tags', {
        selectedMailing: this.selectedMailing,
        tags,
      });
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
      :show-select="hasAccess"
    >
      <template #item.name="{ item }">
        <a v-if="hasAccess" :href="`/editor/${item.id}`">{{ item.name }}</a>
        <template v-else>
          {{ item.name }}
        </template>
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
        <span>{{ item.tags.join(', ') }}</span>
      </template>
      <template #item.createdAt="{ item }">
        <span>{{ item.createdAt | preciseDateTime }}</span>
      </template>
      <template #item.updatedAt="{ item }">
        <span>{{ item.updatedAt | preciseDateTime }}</span>
      </template>
      <template #item.actions="{ item }">
        <bs-mailings-actions-dropdown>
          <bs-mailings-actions-dropdown-item
            v-if="filteredActions.includes(actions.RENAME)"
            :icon="actionsDetails[actions.RENAME].icon"
            :on-click="() => openRenameModal(item)"
          >
            {{ $t(actionsDetails[actions.RENAME].text) }}
          </bs-mailings-actions-dropdown-item>
          <bs-mailings-actions-dropdown-item
            v-if="filteredActions.includes(actions.ADD_TAGS)"
            :icon="actionsDetails[actions.ADD_TAGS].icon"
            :on-click="() => openTagsMenu(item)"
          >
            {{ $t(actionsDetails[actions.ADD_TAGS].text) }}
          </bs-mailings-actions-dropdown-item>
          <bs-mailings-actions-dropdown-item
            v-if="filteredActions.includes(actions.TRANSFER)"
            :icon="actionsDetails[actions.TRANSFER].icon"
            :on-click="() => transferMailing(item)"
          >
            {{ $t(actionsDetails[actions.TRANSFER].text) }}
          </bs-mailings-actions-dropdown-item>

          <bs-mailings-actions-dropdown-item
            v-if="filteredActions.includes(actions.COPY_MAIL)"
            :icon="actionsDetails[actions.COPY_MAIL].icon"
            :on-click="() => openCopyMail(item)"
          >
            {{ $t(actionsDetails[actions.COPY_MAIL].text) }}
          </bs-mailings-actions-dropdown-item>
          <bs-mailings-actions-dropdown-item
            v-if="filteredActions.includes(actions.MOVE_MAIL)"
            :icon="actionsDetails[actions.MOVE_MAIL].icon"
            :on-click="() => openMoveMail(item)"
          >
            {{ $t(actionsDetails[actions.MOVE_MAIL].text) }}
          </bs-mailings-actions-dropdown-item>
          <bs-mailings-actions-dropdown-item
            v-if="filteredActions.includes(actions.DELETE)"
            :icon="actionsDetails[actions.DELETE].icon"
            :on-click="() => displayDeleteModal(item)"
          >
            {{ $t(actionsDetails[actions.DELETE].text) }}
          </bs-mailings-actions-dropdown-item>
        </bs-mailings-actions-dropdown>
      </template>
    </v-data-table>
    <bs-mailings-modal-rename ref="renameDialog" @update="updateName" />
    <mailings-tags-menu
      ref="addTagsMenu"
      :tags="tags"
      :selected-mail-tags="selectedMailTags"
      @update-tags="updateTags"
    />
    <bs-modal-confirm-form
      ref="deleteDialog"
      :with-input-confirmation="false"
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
    <modal-move-mail
      ref="moveMailDialog"
      :title="`${this.$t('global.moveMail')}`"
      @confirm="moveMail"
    >
      <p
        class="black--text"
        v-html="$t('mailings.moveMailConfirmationMessage')"
      />
    </modal-move-mail>
  </div>
</template>
