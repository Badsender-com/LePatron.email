<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsGroupTaxonomyTab from '~/components/group/taxonomy-tab.vue';
import { IS_ADMIN, USER } from '~/store/user';
import { Plus } from 'lucide-vue';

export default {
  name: 'BsPageSettingsTaxonomy',
  components: {
    BsPageHeader,
    BsGroupTaxonomyTab,
    LucidePlus: Plus,
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
    // The sidebar hides this page when the company opted out, but a bookmarked URL
    // does not go through the sidebar. Rather than a bare 403, the page explains
    // where the switch is — a super admin also lands here on a company that has
    // not opted in.
    isFeatureEnabled() {
      return (
        this.group &&
        this.group.emailMetadata &&
        this.group.emailMetadata.enabled === true
      );
    },
    emailBuilderSettingsRoute() {
      return `/groups/${this.$route.params.groupId}/settings/email-builder`;
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
        {{ $t('taxonomy.title') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
      <template v-if="isFeatureEnabled" #actions>
        <v-btn
          color="accent"
          elevation="0"
          @click="$refs.taxonomyTab.openCreateForm()"
        >
          <lucide-plus :size="18" class="mr-2" />
          {{ $t('global.add') }}
        </v-btn>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <p class="taxonomy-page__description">
          {{ $t('taxonomy.description') }}
        </p>

        <v-alert v-if="!isFeatureEnabled" text type="info" class="mt-4">
          <p class="mb-2">
            {{ $t('taxonomy.disabled.message') }}
          </p>
          <v-btn
            :to="emailBuilderSettingsRoute"
            color="accent"
            small
            elevation="0"
          >
            {{ $t('taxonomy.disabled.action') }}
          </v-btn>
        </v-alert>

        <bs-group-taxonomy-tab v-else ref="taxonomyTab" />
      </div>
    </v-container>
  </div>
</template>

<style lang="scss" scoped>
.taxonomy-page {
  &__description {
    color: var(--gray-700);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }
}
</style>
