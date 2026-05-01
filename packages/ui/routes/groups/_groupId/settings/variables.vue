<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import GroupPersonalizedVariableTab from '~/components/group/group-personalized-variable-tab';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';
import { Plus } from 'lucide-vue';

export default {
  name: 'BsPageSettingsVariables',
  components: {
    BsGroupSettingsPageHeader,
    GroupPersonalizedVariableTab,
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
};
</script>

<template>
  <v-container fluid>
    <div class="settings-content">
      <bs-group-settings-page-header
        :title="$t('global.variables')"
        :group-name="group.name"
      >
        <template #actions>
          <v-btn
            color="accent"
            elevation="0"
            @click="$refs.variablesTab.addRow()"
          >
            <lucide-plus :size="18" class="mr-2" />
            {{ $t('global.add') }}
          </v-btn>
        </template>
      </bs-group-settings-page-header>
      <group-personalized-variable-tab ref="variablesTab" />
    </div>
  </v-container>
</template>
