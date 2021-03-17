<script>
import { mapMutations, mapGetters } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { USER, IS_ADMIN } from '~/store/user.js';

import { mailingsItem } from '~/helpers/api-routes.js';
import BsMailingsModalRename from '~/components/mailings/modal-rename.vue';

const TABLE_HIDDEN_COLUMNS_ADMIN = ['userName'];
const TABLE_HIDDEN_COLUMNS_USER = ['actionTransfer'];

export default {
  name: 'MailingsTable',
  components: {
    BsMailingsModalRename,
  },
  model: { prop: 'mailingsSelection', event: 'input' },
  props: {
    mailings: { type: Array, default: () => [] },
    mailingsSelection: { type: Array, default: () => [] },
    // loading: { type: Boolean, default: false },
  },
  data() {
    return {
      loading: false,
      renameModalInfo: {
        show: false,
        newName: '',
        mailingId: false,
      },
    };
  },
  computed: {
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    hiddenCols() {
      return this.isAdmin
        ? TABLE_HIDDEN_COLUMNS_ADMIN
        : TABLE_HIDDEN_COLUMNS_USER;
    },
    localSelection: {
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
      ].filter((column) => !this.hiddenCols.includes(column.value));
    },
    tableOptions() {
      return {
        sortBy: ['updatedAt'],
        sortDesc: [true],
      };
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    displayRenameModal(mailing) {
      this.renameModalInfo = {
        show: true,
        newName: mailing.name,
        mailingId: mailing.id,
      };
    },
    closeRenameModal() {
      this.renameModalInfo = {
        show: false,
        newName: '',
        mailingId: false,
      };
    },
    async updateName(renameModalInfo) {
      const { $axios } = this;
      const { newName, mailingId } = renameModalInfo;
      this.closeRenameModal();
      if (!mailingId) return;
      this.loading = true;
      const updateUri = mailingsItem({ mailingId });
      try {
        const mailingResponse = await $axios.$put(updateUri, { name: newName });
        await this.$emit('change-mailing-index', mailingResponse);
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
        this.renameModalInfo.mailingId = false;
      }
    },
    renameMailing(mailing) {
      this.$emit('rename', mailing);
    },
    transferMailing(mailing) {
      this.$emit('transfer', mailing);
    },
    duplicateMailing(mailing) {
      this.$emit('duplicate', mailing);
    },
  },
};
</script>

<template>
  <div>
    <v-data-table
      v-model="localSelection"
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
          @click="displayRenameModal(item)"
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
          <v-icon>content_copy</v-icon>
        </v-btn>
      </template>
    </v-data-table>
    <bs-mailings-modal-rename
      v-model="renameModalInfo"
      @update="updateName"
      @close="closeRenameModal"
    />
  </div>
</template>
