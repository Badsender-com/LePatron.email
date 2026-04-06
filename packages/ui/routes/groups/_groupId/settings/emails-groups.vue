<script>
import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { getEmailsGroups } from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsEmailsGroupsTab from '~/components/group/emails-groups-tab.vue';
import BsModalCreateEmailsGroup from '~/components/group/modal-create-emails-group.vue';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';

export default {
  name: 'BsPageSettingsEmailsGroups',
  components: {
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
    BsEmailsGroupsTab,
    BsModalCreateEmailsGroup,
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
  <bs-layout-left-menu>
    <template #menu>
      <bs-group-settings-nav :group="group" />
    </template>
    <div class="settings-content">
      <bs-group-settings-page-header
        :title="$tc('global.emailsGroups', 2)"
        :group-name="group.name"
      >
        <template #actions>
          <v-btn color="accent" elevation="0" @click="openCreateModal">
            <v-icon left>
              mdi-plus
            </v-icon>
            {{ $t('global.add') }}
          </v-btn>
        </template>
      </bs-group-settings-page-header>
      <bs-emails-groups-tab ref="emailsGroupsTab" />
    </div>

    <bs-modal-create-emails-group
      ref="createModal"
      :loading="modalLoading"
      @submit="createEmailsGroup"
    />
  </bs-layout-left-menu>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
