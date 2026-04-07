<script>
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsGroupMailingsTab from '~/components/group/mailings-tab.vue';

export default {
  name: 'BsPageSettingsMailings',
  components: {
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
    BsGroupMailingsTab,
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
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <bs-group-settings-nav :group="group" />
    </template>
    <div class="settings-content">
      <bs-group-settings-page-header
        :title="$tc('global.mailing', 2)"
        :group-name="group.name"
      />
      <bs-group-mailings-tab />
    </div>
  </bs-layout-left-menu>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
