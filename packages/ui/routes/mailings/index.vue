<script>
import { mapGetters } from 'vuex';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import mixinCreateMailing from '~/helpers/mixins/mixin-create-mailing';
import mixinCurrentLocation from '~/helpers/mixins/mixin-current-location';
import { mailings } from '~/helpers/api-routes.js';
import BsMailingsModalNew from '~/routes/mailings/__partials/mailings-new-modal.vue';
import { ACL_USER } from '~/helpers/pages-acls.js';
import * as mailingsHelpers from '~/helpers/mailings.js';
import WorkspaceTree from '~/routes/mailings/__partials/workspace-tree';
import MailingsTable from '~/routes/mailings/__partials/mailings-table';
import MailingsFilters from '~/routes/mailings/__partials/mailings-filters';
import MailingsHeader from '~/routes/mailings/__partials/mailings-header';
import MailingsSelectionActions from '~/routes/mailings/__partials/mailings-selection-actions';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';
export default {
  name: 'PageMailings',
  components: {
    WorkspaceTree,
    MailingsTable,
    MailingsFilters,
    MailingsSelectionActions,
    BsMailingsModalNew,
    MailingsHeader,
  },
  mixins: [mixinPageTitle, mixinCreateMailing, mixinCurrentLocation],
  meta: { acl: ACL_USER },
  middleware({ store, redirect }) {
    if (store.getters[`${USER}/${IS_ADMIN}`]) {
      redirect('/groups');
    }
  },
  async asyncData({ $axios, query }) {
    try {
      console.log('calling async data');

      console.log(!!query?.wid || !!query?.fid);
      if (!!query?.wid || !!query?.fid) {
        console.log({ currentLocation: this.currentLocationParam });
        console.log('called after currentLocation');
        await this.getFolderAndWorkspaceData($axios, query);
        const mailingsResponse = await $axios.$get(mailings(), {
          params: this.currentLocationParam,
        });

        return {
          mailings: mailingsResponse.items,
          tags: mailingsResponse.meta.tags,
          mailingsIsLoading: false,
        };
      }
    } catch (error) {
      return { mailingsIsLoading: false, mailingsIsError: true };
    }
  },
  data: () => ({
    mailingsIsLoading: false,
    mailingsIsError: false,
    loading: false,
    mailings: [],
    mailingsSelection: [],
    workspace: {},
    tags: [],
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
    openNewMailModal() {
      this.$refs.modalNewMailDialog.open();
    },
    handleFilterChange(filterValues) {
      this.filterValues = filterValues;
    },
    async handleCreateNewMail(createMailModalData) {
      this.loading = true;
      await this.mixinCreateMailing(
        createMailModalData.template,
        'loading',
        createMailModalData.defaultMailName
      );
      this.loading = false;
    },
    async fetchData() {
      await this.getFolderAndWorkspaceData(this.$axios, this.$route?.query);
      await this.fetchMailListingData();
    },
    async fetchMailListingData() {
      try {
        if (this.$route.query?.wid || this.$route.query?.fid) {
          this.mailingsIsLoading = true;
          const mailingsResponse = await this.$axios.$get(mailings(), {
            params: this.currentLocationParam,
          });

          this.mailings = mailingsResponse.items;
          this.tags = mailingsResponse.meta.tags;
          this.mailingsIsLoading = false;
        }
      } catch (error) {
        this.mailingsIsLoading = false;
        this.mailingsIsError = true;
      } finally {
        this.mailingsSelection = [];
      }
    },
    onTagCreate(newTag) {
      this.tags = [...new Set([newTag, ...this.tags])];
    },
    async onTagsUpdate(tagsUpdates) {
      const { $axios } = this;
      this.loading = true;
      try {
        const mailingsResponse = await $axios.$put(mailings(), {
          items: this.mailingsSelection.map((mailing) => mailing.id),
          tags: tagsUpdates,
        });
        this.tags = mailingsResponse.meta.tags;
        await this.fetchData();
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
    async handleUpdateTags(tagsInformations) {
      const { $axios } = this;
      this.loading = true;
      const { tags, selectedMailing } = tagsInformations;
      try {
        await $axios.$put(mailings(), {
          items: [selectedMailing.id],
          tags,
        });
        await this.fetchMailListingData();
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
        <v-list-item class="justify-center">
          <v-btn
            class="my-4 new-mail-button"
            color="primary"
            tile
            :disabled="!hasAccess"
            @click="openNewMailModal"
          >
            <v-icon left>
              mdi-plus
            </v-icon>
            {{ $t('global.newMail') }}
          </v-btn>
        </v-list-item>
      </v-list>
      <workspace-tree />
    </template>
    <v-card>
      <v-skeleton-loader :loading="mailingsIsLoading" type="table">
        <mailings-header />
        <mailings-selection-actions
          :mailings-selection="mailingsSelection"
          :tags="tags"
          @createTag="onTagCreate"
          @updateTags="onTagsUpdate"
          @on-refetch="fetchMailListingData()"
        />
        <mailings-filters :tags="tags" @change="handleFilterChange" />
        <mailings-table
          v-model="mailingsSelection"
          :mailings="filteredMailings"
          :tags="tags"
          @on-refetch="fetchMailListingData()"
          @update-tags="handleUpdateTags"
        />
      </v-skeleton-loader>
    </v-card>
    <bs-mailings-modal-new
      ref="modalNewMailDialog"
      :loading-parent="loading"
      @create-new-mail="handleCreateNewMail"
    />
  </bs-layout-left-menu>
</template>
<style>
.new-mail-button {
  width: 90%;
}
</style>
