<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsGroupAiFeaturesTab from '~/components/group/ai-features-tab.vue';
import BsGroupMcpAccessOption from '~/components/group/mcp-access-option.vue';
import { CAN, USER } from '~/store/user';
import { CAPABILITIES } from '../../../../../shared/access/roles.js';

export default {
  name: 'BsPageSettingsAiFeatures',
  components: {
    BsPageHeader,
    BsGroupAiFeaturesTab,
    BsGroupMcpAccessOption,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: acls.ACL_GROUP_MANAGE_TECH,
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
    ...mapGetters(USER, { can: CAN }),
    showGroupBadge() {
      return this.can(CAPABILITIES.PLATFORM_MANAGE) && this.group.name;
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
        {{ $t('aiFeatures.title') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <bs-group-ai-features-tab
          :active="true"
          :is-platform="!!group.isPlatform"
        />
        <bs-group-mcp-access-option
          v-if="group.id"
          class="mt-6"
          :group="group"
          @update="group.enableMcp = $event.enableMcp"
        />
      </div>
    </v-container>
  </div>
</template>
