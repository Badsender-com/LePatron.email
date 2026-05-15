<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsExportOptionsTab from '~/components/group/export-options-tab.vue';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';

export default {
  name: 'BsPageSettingsExportOptions',
  components: {
    BsPageHeader,
    BsExportOptionsTab,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  async asyncData(nuxtContext) {
    return safeFetchGroup(nuxtContext);
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
      isGroupAdmin: IS_GROUP_ADMIN,
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
        console.error('[ExportOptions] Failed to refresh group:', error);
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
        {{ $t('exportOptions.title') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <bs-export-options-tab
          :group="group"
          :active="true"
          @update="refreshGroup"
        />
      </div>
    </v-container>
  </div>
</template>
