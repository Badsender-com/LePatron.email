<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsGroupAiFeaturesTab from '~/components/group/ai-features-tab.vue';
import BsGroupMcpAccessOption from '~/components/group/mcp-access-option.vue';
import { CAN, M_USER_SET, USER } from '~/store/user';
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
  methods: {
    // The MCP section saves the access and the retex: the page follows.
    onMcpUpdate(saved) {
      this.group.enableMcp = saved.enableMcp;
      this.group.allowRetex = saved.allowRetex;
      this.followInSidebar(saved);
    },
    // The sidebar's connected applications link reads the user's group, or a
    // super admin's selected one: it follows a change of the group shown.
    followInSidebar(saved) {
      const { group, selectedGroup } = this.$store.state.user.info || {};
      const id = String(this.group.id || this.group._id);
      const changes = { enableMcp: saved.enableMcp };
      ['group', 'selectedGroup'].forEach((key) => {
        const held = key === 'group' ? group : selectedGroup;
        if (held && String(held.id || held._id) === id) {
          this.$store.commit(`${USER}/${M_USER_SET}`, {
            [key]: { ...held, ...changes },
          });
        }
      });
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
        >
          <bs-group-mcp-access-option
            v-if="group.id"
            :group="group"
            @update="onMcpUpdate"
          />
        </bs-group-ai-features-tab>
      </div>
    </v-container>
  </div>
</template>
