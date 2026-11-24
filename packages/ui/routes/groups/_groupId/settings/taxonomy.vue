<script>
import * as acls from '~/helpers/pages-acls.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import mixinTaxonomyManage from '~/helpers/mixins/mixin-taxonomy-manage.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsTaxonomyWorkspace from '~/components/group/taxonomy-workspace.vue';
import BsTaxonomyGettingStarted from '~/components/group/taxonomy-getting-started.vue';
import {
  hasNoCompanyDimension,
  suggestedDimensions,
} from '~/helpers/taxonomy-suggestions.js';
import { DIMENSIONS_PER_COMPANY } from '~/helpers/taxonomy-builder.js';
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
  // An unsaved crossings matrix warns before the page is left, before the
  // browser goes back to another dimension or company, and before the tab
  // closes.
  beforeRouteLeave(to, from, next) {
    next(this.confirmLeave());
  },
  beforeRouteUpdate(to, from, next) {
    next(this.confirmLeave());
  },
  async asyncData(nuxtContext) {
    return safeFetchGroup(nuxtContext);
  },
  data() {
    return {
      group: {},
      pointsTotal: 0,
      dimensions: [],
      // Started from a suggestion: the panel stays for the next ones (a
      // language under the market just created) until it is hidden.
      startedFromSuggestions: false,
      startDismissed: false,
    };
  },
  head() {
    return { title: this.settingsTitle };
  },
  computed: {
    // As in the tree: told before the click rather than by a refusal.
    isFull() {
      return this.dimensions.length >= DIMENSIONS_PER_COMPANY;
    },
    isEmpty() {
      return hasNoCompanyDimension(this.dimensions);
    },
    showStart() {
      if (!this.dimensions.length) return false;
      if (this.isEmpty) return true;
      return (
        this.startedFromSuggestions &&
        !this.startDismissed &&
        suggestedDimensions(this.dimensions).length > 0
      );
    },
    showGroupBadge() {
      return this.can(CAPABILITIES.PLATFORM_MANAGE) && this.group.name;
    },
  },
  mounted() {
    window.addEventListener('beforeunload', this.warnBeforeUnload);
  },
  beforeDestroy() {
    window.removeEventListener('beforeunload', this.warnBeforeUnload);
  },
  methods: {
    detail() {
      return (
        (this.$refs.workspace && this.$refs.workspace.$refs.detail) || null
      );
    },
    confirmLeave() {
      const detail = this.detail();
      return !detail || detail.confirmLeave();
    },
    warnBeforeUnload(event) {
      const detail = this.detail();
      if (!detail || !detail.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    },
    suggest(suggestion) {
      this.startedFromSuggestions = true;
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
          class="mr-2 d-none d-md-flex"
          role="status"
        >
          {{ $t('taxonomy.workspace.points.title', { n: pointsTotal }) }}
        </v-chip>
        <v-btn
          v-if="canManageTaxonomy"
          color="accent"
          elevation="0"
          :disabled="isFull"
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
          v-if="showStart"
          :dimensions="dimensions"
          :dismissible="!isEmpty"
          @dismiss="startDismissed = true"
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
