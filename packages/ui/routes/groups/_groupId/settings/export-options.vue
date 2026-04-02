<script>
import { mapGetters } from 'vuex';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsExportOptionsTab from '~/components/group/export-options-tab.vue';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';

export default {
  name: 'BsPageSettingsExportOptions',
  components: {
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
    BsExportOptionsTab,
  },
  mixins: [mixinPageTitle],
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
    return { title: this.pageTitle };
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
    pageTitle() {
      return `${this.$t('modules.settings')} > ${this.group.name || ''}`;
    },
    title() {
      return this.group.name
        ? `${this.$t('modules.settings')} > ${this.group.name}`
        : this.$t('modules.settings');
    },
  },
  watch: {
    'group.name': {
      immediate: true,
      handler(newName) {
        if (newName) {
          this.mixinPageTitleUpdateTitle(`${this.$t('modules.settings')} > ${newName}`);
        }
      },
    },
  },
  methods: {
    async refreshGroup() {
      const { $axios, $route: { params } } = this;
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
  <bs-layout-left-menu>
    <template #menu>
      <bs-group-settings-nav :group="group" />
    </template>
    <div class="settings-content">
      <bs-group-settings-page-header :title="$t('exportOptions.title')" :group-name="group.name" />
      <bs-export-options-tab
        :group="group"
        :active="true"
        @update="refreshGroup"
      />
    </div>
  </bs-layout-left-menu>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
