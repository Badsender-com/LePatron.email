<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsGroupQualitySettingsTab from '~/components/group/quality-settings-tab.vue';
import { IS_ADMIN, USER } from '~/store/user';

// The quality control's settings of a group
// (docs/adr/0004-quality-settings-per-group-and-template.md): a super admin
// for any group, a company admin for their own.
export default {
  name: 'BsPageSettingsQuality',
  components: {
    BsPageHeader,
    BsGroupQualitySettingsTab,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: [acls.ACL_ADMIN, acls.ACL_GROUP_ADMIN],
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
    }),
    showGroupBadge() {
      return this.isAdmin && this.group.name;
    },
  },
  methods: {
    // Refetched rather than patched locally: the saved state is what the
    // server returns.
    async refreshGroup() {
      const { group } = await safeFetchGroup({
        $axios: this.$axios,
        params: this.$route.params,
        store: this.$store,
        app: { i18n: this.$i18n },
      });
      this.group = group;
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
        {{ $t('qualitySettings.title') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <bs-group-quality-settings-tab :group="group" @update="refreshGroup" />
      </div>
    </v-container>
  </div>
</template>
