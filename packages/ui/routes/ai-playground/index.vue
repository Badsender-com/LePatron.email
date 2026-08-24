<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as api from '~/helpers/ai-playground-routes.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsTimestamp from '~/components/bs-timestamp.vue';
import { Plus, FlaskConical, Star } from 'lucide-vue';

export default {
  name: 'PageAiPlaygroundList',
  components: {
    BsPageHeader,
    BsDataTable,
    BsTimestamp,
    LucidePlus: Plus,
    LucideFlaskConical: FlaskConical,
    LucideStar: Star,
  },
  mixins: [mixinPageTitle],
  meta: { acl: acls.ACL_ADMIN, sidebarModule: 'settings' },
  async asyncData({ $axios }) {
    try {
      const [res, facets] = await Promise.all([
        $axios.$get(api.aiPlaygroundScenarios()),
        $axios.$get(api.aiPlaygroundScenarioFacets()).catch(() => ({})),
      ]);
      return {
        items: res.items || [],
        total: res.total || 0,
        facets: {
          skillIds: (facets && facets.skillIds) || [],
          tags: (facets && facets.tags) || [],
        },
      };
    } catch (err) {
      return { items: [], total: 0 };
    }
  },
  data() {
    return {
      items: [],
      total: 0,
      filters: { skillId: null, tag: null, search: '' },
      facets: { skillIds: [], tags: [] },
      searchTimer: null,
    };
  },
  head() {
    return { title: this.pageTitle };
  },
  computed: {
    pageTitle() {
      return this.$t('aiPlayground.pageTitle');
    },
    headers() {
      return [
        { text: this.$t('aiPlayground.headers.name'), value: 'name' },
        { text: this.$t('aiPlayground.headers.skill'), value: 'skillRef' },
        {
          text: this.$t('aiPlayground.headers.runs'),
          value: 'runCount',
          align: 'right',
        },
        { text: this.$t('aiPlayground.headers.lastRun'), value: 'lastRunAt' },
        {
          text: this.$t('aiPlayground.headers.lastRunStatus'),
          value: 'lastRunStatus',
        },
        {
          text: this.$t('aiPlayground.headers.golden'),
          value: 'goldenRunId',
          align: 'center',
        },
        { text: this.$t('global.updatedAt'), value: 'updatedAt' },
      ];
    },
  },
  beforeDestroy() {
    clearTimeout(this.searchTimer);
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    skillLabel(item) {
      const r = item.skillRef || {};
      if (!r.skillId) return '—';
      if (r.mode === 'pinned') {
        return `${r.skillId} v${r.versionMajor}.${r.versionMinor || 0}`;
      }
      return r.skillId;
    },
    statusColor(s) {
      return s === 'SUCCESS' ? 'success' : 'error';
    },
    statusLabel(s) {
      return s ? this.$t(`aiPlayground.status.${s}`) : '';
    },
    async reload() {
      const params = {};
      if (this.filters.skillId) params.skillId = this.filters.skillId;
      if (this.filters.tag) params.tag = this.filters.tag;
      if (this.filters.search) params.search = this.filters.search;
      try {
        const res = await this.$axios.$get(api.aiPlaygroundScenarios(), {
          params,
        });
        this.items = res.items || [];
        this.total = res.total || 0;
      } catch (err) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
    // Live search with a 300ms debounce (parity with the skills/expertise
    // lists), instead of requiring Enter/blur.
    onSearchInput(value) {
      this.filters.search = value;
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.reload(), 300);
    },
    openScenario(item) {
      this.$router.push(`/ai-playground/${item.scenarioId}`);
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
        {{ pageTitle }}
      </template>
      <template #actions>
        <v-btn color="accent" elevation="0" :to="'/ai-playground/new'" exact>
          <lucide-plus :size="18" class="mr-2" />
          {{ $t('aiPlayground.actions.newScenario') }}
        </v-btn>
      </template>
    </bs-page-header>

    <v-container fluid>
      <p class="tab-intro">
        {{ $t('aiPlayground.intro') }}
      </p>

      <div class="filters-row">
        <v-select
          v-model="filters.skillId"
          :items="facets.skillIds"
          :label="$t('aiPlayground.filters.skill')"
          dense
          outlined
          hide-details
          clearable
          class="filter-field"
          @change="reload"
        />
        <v-select
          v-model="filters.tag"
          :items="facets.tags"
          :label="$t('aiPlayground.filters.tag')"
          dense
          outlined
          hide-details
          clearable
          class="filter-field"
          @change="reload"
        />
        <v-text-field
          :value="filters.search"
          :label="$t('aiPlayground.filters.search')"
          dense
          outlined
          hide-details
          clearable
          class="filter-field"
          @input="onSearchInput"
        />
      </div>

      <bs-data-table
        :headers="headers"
        :items="items"
        item-key="scenarioId"
        clickable
        @click:row="openScenario"
      >
        <template #item.name="{ item }">
          <span class="font-weight-medium">{{ item.name }}</span>
          <div class="text-caption text--secondary">
            {{ item.scenarioId }}
          </div>
        </template>
        <template #item.skillRef="{ item }">
          <span class="text-caption">{{ skillLabel(item) }}</span>
        </template>
        <template #item.runCount="{ item }">
          <span v-if="item.runCount" class="text-caption">{{
            item.runCount
          }}</span>
          <span v-else class="text--disabled">—</span>
        </template>
        <template #item.lastRunAt="{ item }">
          <bs-timestamp :value="item.lastRunAt" />
        </template>
        <template #item.lastRunStatus="{ item }">
          <v-chip
            v-if="item.lastRunStatus"
            small
            :color="statusColor(item.lastRunStatus)"
            :outlined="item.lastRunStatus !== 'SUCCESS'"
            :dark="item.lastRunStatus === 'SUCCESS'"
          >
            {{ statusLabel(item.lastRunStatus) }}
          </v-chip>
          <span v-else class="text--disabled">—</span>
        </template>
        <template #item.goldenRunId="{ item }">
          <v-tooltip v-if="item.goldenRunId" bottom>
            <template #activator="{ on, attrs }">
              <span v-bind="attrs" v-on="on">
                <lucide-star
                  :size="16"
                  class="accent--text"
                  fill="currentColor"
                />
              </span>
            </template>
            <span>{{ $t('aiPlayground.headers.goldenTooltip') }}</span>
          </v-tooltip>
        </template>
        <template #item.updatedAt="{ item }">
          <bs-timestamp :value="item.updatedAt" />
        </template>
        <template #no-data>
          <div class="text-center pa-6">
            <lucide-flask-conical
              :size="48"
              class="grey--text text--lighten-1"
            />
            <p class="text-body-1 grey--text mt-4">
              {{ $t('aiPlayground.list.empty') }}
            </p>
          </div>
        </template>
      </bs-data-table>
    </v-container>
  </div>
</template>

<style lang="scss" scoped>
.tab-intro {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.6);
  max-width: 760px;
  margin-bottom: 1.25rem;
  line-height: 1.5;
}
.filters-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.filter-field {
  max-width: 280px;
}
</style>
