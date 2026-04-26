<script>
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsGroupMailingsTab from '~/components/group/mailings-tab.vue';

export default {
  name: 'BsPageSettingsMailings',
  components: {
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
  <v-container fluid>
    <div class="settings-content">
      <bs-group-settings-page-header
        :title="$tc('global.mailing', 2)"
        :group-name="group.name"
      />
      <bs-group-mailings-tab />
    </div>
  </v-container>
</template>
