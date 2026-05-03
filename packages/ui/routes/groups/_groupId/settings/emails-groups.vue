<script>
import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { getEmailsGroups } from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/BsPageHeader.vue';
import BsEmailsGroupsTab from '~/components/group/emails-groups-tab.vue';
import BsModalCreateEmailsGroup from '~/components/group/modal-create-emails-group.vue';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';
import { Plus } from 'lucide-vue';

export default {
  name: 'BsPageSettingsEmailsGroups',
  components: {
    BsPageHeader,
    BsEmailsGroupsTab,
    BsModalCreateEmailsGroup,
    LucidePlus: Plus,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: [acls.ACL_ADMIN, acls.ACL_GROUP_ADMIN],
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const groupResponse = await $axios.$get(apiRoutes.groupsItem(params));
      return { group: groupResponse };
    } catch (error) {
      console.error(error);
      return { group: {} };
    }
  },
  data() {
    return {
      group: {},
      modalLoading: false,
    };
  },
  head() {
    return { title: this.settingsTitle };
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
    showGroupBadge() {
      return this.isAdmin && this.group.name;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    openCreateModal() {
      this.$refs.createModal.open();
    },
    async createEmailsGroup(emailsGroup) {
      try {
        this.modalLoading = true;
        const { groupId } = this.$route.params;
        await this.$axios.$post(getEmailsGroups(), {
          ...emailsGroup,
          groupId,
        });
        this.$refs.createModal.close();
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
        if (this.$refs.emailsGroupsTab) {
          this.$refs.emailsGroupsTab.fetchData();
        }
      } catch (error) {
        const errorMessage =
          error.response?.status === 409
            ? this.$t('global.errors.emailsGroupExist')
            : this.$t('global.errors.errorOccured');
        this.showSnackbar({
          text: errorMessage,
          color: 'error',
        });
      } finally {
        this.modalLoading = false;
      }
    },
  },
};
</script>

<template>
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $tc('global.emailsGroups', 2) }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
      <template #actions>
        <v-btn color="accent" elevation="0" @click="openCreateModal">
          <lucide-plus :size="18" class="mr-2" />
          {{ $t('global.add') }}
        </v-btn>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <bs-emails-groups-tab ref="emailsGroupsTab" />
      </div>

      <bs-modal-create-emails-group
        ref="createModal"
        :loading="modalLoading"
        @submit="createEmailsGroup"
      />
    </v-container>
  </div>
</template>
