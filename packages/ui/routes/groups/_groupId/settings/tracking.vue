<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/BsPageHeader.vue';
import TrackingParamsTab from '~/components/group/tracking-params-tab.vue';
import { IS_ADMIN, USER } from '~/store/user';

export default {
  name: 'BsPageSettingsTracking',
  components: {
    BsPageHeader,
    TrackingParamsTab,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: acls.ACL_GROUP_ADMIN,
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
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
    }),
    showGroupBadge() {
      return this.isAdmin && this.group.name;
    },
  },
  methods: {
    async refreshGroup() {
      const {
        $axios,
        $route: { params },
      } = this;
      try {
        const groupResponse = await $axios.$get(apiRoutes.groupsItem(params));
        this.group = groupResponse;
      } catch (error) {
        console.error('[Tracking] Failed to refresh group:', error);
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
        {{ $t('trackingConfig.title') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <tracking-params-tab :group="group" @update="refreshGroup" />
      </div>
    </v-container>
  </div>
</template>
