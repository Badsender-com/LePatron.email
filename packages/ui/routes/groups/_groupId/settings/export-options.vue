<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsExportOptionsTab from '~/components/group/export-options-tab.vue';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';

export default {
  name: 'BsPageSettingsExportOptions',
  components: {
    BsGroupSettingsPageHeader,
    BsExportOptionsTab,
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
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
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
  <v-container fluid>
    <div class="settings-content">
      <bs-group-settings-page-header
        :title="$t('exportOptions.title')"
        :group-name="group.name"
      />
      <bs-export-options-tab
        :group="group"
        :active="true"
        @update="refreshGroup"
      />
    </div>
  </v-container>
</template>
