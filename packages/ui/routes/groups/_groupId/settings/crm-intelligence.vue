<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/BsPageHeader.vue';
import BsCrmIntelligenceTab from '~/components/group/crm-intelligence-tab.vue';

export default {
  name: 'BsPageSettingsCrmIntelligence',
  components: {
    BsPageHeader,
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
  computed: {
    showGroupBadge() {
      return this.group.name;
    },
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
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $t('crmIntelligence.dashboards') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <bs-crm-intelligence-tab
          :group="group"
          :active="true"
          @update="refreshGroup"
          @change-tab="changeTab"
        />
      </div>
    </v-container>
  </div>
</template>
