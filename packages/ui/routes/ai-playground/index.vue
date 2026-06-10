<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as api from '~/helpers/ai-playground-routes.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import { Plus, FlaskConical, Star } from 'lucide-vue';

export default {
  name: 'PageAiPlaygroundList',
  components: {
    BsPageHeader,
    BsDataTable,
    LucidePlus: Plus,
    LucideFlaskConical: FlaskConical,
    LucideStar: Star,
  },
  mixins: [mixinPageTitle],
  meta: { acl: acls.ACL_ADMIN, sidebarModule: 'settings' },
  async asyncData({ $axios }) {
    try {
      const res = await $axios.$get(api.aiPlaygroundScenarios());
      return { items: res.items || [], total: res.total || 0 };
    } catch (err) {
      return { items: [], total: 0 };
    }
  },
  data() {
    return {
      items: [],
      total: 0,
      filters: { skillId: '', tag: '', search: '' },
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
          text: this.$t('aiPlayground.headers.golden'),
          value: 'goldenRunId',
          align: 'center',
        },
        { text: this.$t('global.updatedAt'), value: 'updatedAt' },
      ];
    },
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
    formatDate(d) {
      return d ? new Date(d).toLocaleString() : '';
    },
    async reload() {
      const params = {};
      if (this.filters.skillId) params.skillId = this.filters.skillId;
      if (this.filters.tag) params.tag = this.filters.tag;
      if (this.filters.search) params.search = this.filters.search;
      const res = await this.$axios.$get(api.aiPlaygroundScenarios(), {
        params,
      });
      this.items = res.items || [];
      this.total = res.total || 0;
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
        <v-text-field
          v-model="filters.skillId"
          :label="$t('aiPlayground.filters.skill')"
          dense
          outlined
          hide-details
          clearable
          class="filter-field"
          @change="reload"
        />
        <v-text-field
          v-model="filters.tag"
          :label="$t('aiPlayground.filters.tag')"
          dense
          outlined
          hide-details
          clearable
          class="filter-field"
          @change="reload"
        />
        <v-text-field
          v-model="filters.search"
          :label="$t('aiPlayground.filters.search')"
          dense
          outlined
          hide-details
          clearable
          class="filter-field"
          @change="reload"
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
        <template #item.goldenRunId="{ item }">
          <lucide-star
            v-if="item.goldenRunId"
            :size="16"
            class="accent--text"
            fill="currentColor"
          />
        </template>
        <template #item.updatedAt="{ item }">
          <span class="text-caption text--secondary">{{
            formatDate(item.updatedAt)
          }}</span>
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
