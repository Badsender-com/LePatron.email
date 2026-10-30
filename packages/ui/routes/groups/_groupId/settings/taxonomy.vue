<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsTaxonomyDimensions from '~/components/group/taxonomy-dimensions.vue';
import { CAN, USER } from '~/store/user';
import { Plus, RotateCcw } from 'lucide-vue';
import { CAPABILITIES } from '../../../../../shared/access/roles.js';

export default {
  name: 'BsPageSettingsTaxonomy',
  components: {
    BsPageHeader,
    BsTaxonomyDimensions,
    LucidePlus: Plus,
    LucideRotateCcw: RotateCcw,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: acls.ACL_GROUP_MANAGE,
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
          outlined
          class="mr-2"
          @click="$refs.dimensions.openRestoreDefaults()"
        >
          <lucide-rotate-ccw :size="18" class="mr-2" />
          {{ $t('taxonomy.defaults.action') }}
        </v-btn>
        <v-btn
          color="accent"
          elevation="0"
          @click="$refs.dimensions.openCreateForm()"
        >
          <lucide-plus :size="18" class="mr-2" />
          {{ $t('taxonomy.empty.action') }}
        </v-btn>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <p class="taxonomy-page__description">
          {{ $t('taxonomy.description') }}
        </p>

        <bs-taxonomy-dimensions ref="dimensions" />
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
