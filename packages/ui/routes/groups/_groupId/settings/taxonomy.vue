<script>
import * as acls from '~/helpers/pages-acls.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import mixinTaxonomyManage from '~/helpers/mixins/mixin-taxonomy-manage.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsTaxonomyWorkspace from '~/components/group/taxonomy-workspace.vue';
import BsTaxonomyGettingStarted from '~/components/group/taxonomy-getting-started.vue';
import { hasNoCompanyDimension } from '~/helpers/taxonomy-suggestions.js';
import { Eye, Plus } from 'lucide-vue';
import { CAPABILITIES } from '../../../../../shared/access/roles.js';

export default {
  name: 'BsPageSettingsTaxonomy',
  components: {
    BsPageHeader,
    BsTaxonomyWorkspace,
    BsTaxonomyGettingStarted,
    LucideEye: Eye,
    LucidePlus: Plus,
  },
  mixins: [mixinSettingsTitle, mixinTaxonomyManage],
  meta: {
    acl: acls.ACL_GROUP_MANAGE,
  },
  // An unsaved crossings matrix warns before the page is left.
  beforeRouteLeave(to, from, next) {
    const detail = this.$refs.workspace && this.$refs.workspace.$refs.detail;
    next(!detail || detail.confirmLeave());
  },
  async asyncData(nuxtContext) {
    return safeFetchGroup(nuxtContext);
  },
  data() {
    return {
      group: {},
      pointsTotal: 0,
      dimensions: [],
    };
  },
  head() {
    return { title: this.settingsTitle };
  },
  computed: {
    isEmpty() {
      return hasNoCompanyDimension(this.dimensions);
    },
    showGroupBadge() {
      return this.can(CAPABILITIES.PLATFORM_MANAGE) && this.group.name;
    },
  },
  methods: {
    suggest(suggestion) {
      this.$refs.workspace.openDeclareForm(suggestion.parentName, {
        label: this.$t(suggestion.labelKey),
        name: suggestion.name,
        role: suggestion.role,
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
        {{ $t('taxonomy.title') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
      <template #actions>
        <v-chip
          v-if="pointsTotal"
          small
          outlined
          color="warning"
          class="mr-2"
          role="status"
        >
          {{ $t('taxonomy.workspace.points.title', { n: pointsTotal }) }}
        </v-chip>
        <v-btn
          v-if="canManageTaxonomy"
          color="accent"
          elevation="0"
          @click="$refs.workspace.openDeclareForm()"
        >
          <lucide-plus :size="18" class="mr-2" />
          {{ $t('taxonomy.dimensions.declare') }}
        </v-btn>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <p class="taxonomy-page__description">
          {{ $t('taxonomy.description') }}
        </p>

        <p
          v-if="!canManageTaxonomy"
          class="taxonomy-page__read-only"
          role="note"
        >
          <lucide-eye :size="16" class="mr-2" />
          {{ $t('taxonomy.readOnly') }}
        </p>

        <bs-taxonomy-getting-started
          v-if="dimensions.length && isEmpty"
          :dimensions="dimensions"
          @suggest="suggest"
        />
        <bs-taxonomy-workspace
          ref="workspace"
          @points="pointsTotal = $event"
          @loaded="dimensions = $event"
        />
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

  &__read-only {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    margin-bottom: 1rem;
    background: #fff;
    border: 1px solid var(--gray-300);
    border-radius: 7px;
    color: var(--gray-700);
    font-size: 0.8125rem;
  }
}
</style>
