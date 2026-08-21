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
      <template #actions>
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

        <bs-group-taxonomy-tab ref="taxonomyTab" />
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
