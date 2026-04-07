<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsCrmIntelligenceTab from '~/components/group/crm-intelligence-tab.vue';

export default {
  name: 'BsPageSettingsCrmIntelligence',
  components: {
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
    BsCrmIntelligenceTab,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: acls.ACL_ADMIN,
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
    };
  },
  head() {
    return { title: this.settingsTitle };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async refreshGroup() {
      const {
        $axios,
        $route: { params },
      } = this;
      try {
        const groupResponse = await $axios.$get(apiRoutes.groupsItem(params));
        this.group = groupResponse;
      } catch (error) {
        console.error('[CrmIntelligence] Failed to refresh group:', error);
      }
    },
    changeTab(tabId) {
      // Navigate to the appropriate settings page
      const routeMap = {
        'group-general': 'general',
        'group-integrations': 'integrations',
      };
      const route = routeMap[tabId];
      if (route) {
        this.$router.push(
          `/groups/${this.$route.params.groupId}/settings/${route}`
        );
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
        :title="$t('crmIntelligence.dashboards')"
        :group-name="group.name"
      />
      <bs-crm-intelligence-tab
        :group="group"
        :active="true"
        @update="refreshGroup"
        @change-tab="changeTab"
      />
    </div>
  </bs-layout-left-menu>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
