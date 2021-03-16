<script>
import { mapMutations, mapGetters } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import { mailings, mailingsItem } from '~/helpers/api-routes.js';
import { ACL_USER } from '~/helpers/pages-acls.js';
import * as mailingsHelpers from '~/helpers/mailings.js';
import WorkspaceTree from '~/routes/mailings/__partials/workspace-tree';
import MailingsTable from '~/routes/mailings/__partials/mailings-table';
import BsMailingsModalRename from '~/components/mailings/modal-rename.vue';
import MailingsFilters from '~/routes/mailings/__partials/mailings-filters';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';
export default {
  name: 'PageMailings',
  components: {
    WorkspaceTree,
    MailingsTable,
    MailingsFilters,
    BsMailingsModalRename,
  },
  mixins: [mixinPageTitle],
  meta: { acl: ACL_USER },
  async asyncData({ $axios, query }) {
    try {
      const mailingsResponse = await $axios.$get(mailings(), {
        params: { workspaceId: query?.wid },
      });
      return {
        mailings: mailingsResponse.items,
        tags: mailingsResponse.meta.tags,
        mailingsIsLoading: false,
        selectedItem: query?.wid,
      };
    } catch (error) {
      return { mailingsIsLoading: false, mailingsIsError: true };
    }
  },
  data: () => ({
    mailingsIsLoading: true,
    mailingsIsError: false,
    selectedItem: '',
    mailings: [],
    tags: [],
    renameModalInfo: {
      show: false,
      newName: '',
      mailingId: false,
    },
    duplicateModalInfo: {
      show: false,
      newName: '',
      mailingId: false,
    },
    filterValues: null,
  }),

  computed: {
    filteredMailings() {
      const filterFunction = mailingsHelpers.createFilters(this.filterValues);
      return this.mailings.filter(filterFunction);
    },
    title() {
      return 'Emails';
    },
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
    groupAdminUrl() {
      return `/groups/${this.$store.state.user?.info?.group?.id}`;
    },
  },
  watchQuery: ['wid'],
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    handleFilterChange(filterValues) {
      this.filterValues = filterValues;
    },
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
        const mailingIndex = this.mailings.findIndex(
          (mailing) => mailing.id === mailingResponse.id
        );
        this.$set(this.mailings, mailingIndex, mailingResponse);
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
  },
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <v-list>
        <v-list-item v-if="isGroupAdmin" nuxt link :to="groupAdminUrl">
          <v-list-item-avatar>
            <v-icon>settings</v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>
              {{ $t('global.settings') }}
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
      <workspace-tree :selected-item="selectedItem" />
    </template>
    <v-card>
      <v-skeleton-loader :loading="mailingsIsLoading" type="table">
        <mailings-filters :tags="tags" @change="handleFilterChange" />
        <mailings-table
          :mailings="filteredMailings"
          @rename="displayRenameModal"
        />
        <bs-mailings-modal-rename
          v-model="renameModalInfo"
          @update="updateName"
          @close="closeRenameModal"
        />
      </v-skeleton-loader>
    </v-card>
  </bs-layout-left-menu>
</template>
