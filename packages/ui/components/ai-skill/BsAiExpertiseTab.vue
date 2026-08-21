<script>
import { mapMutations } from 'vuex';
import { skillErrorMessage } from '~/helpers/ai-skill-errors.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as api from '~/helpers/ai-skill-routes.js';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsAiExpertiseCreateModal from '~/components/ai-skill/BsAiExpertiseCreateModal.vue';
import BsTimestamp from '~/components/ai-skill/BsTimestamp.vue';
import { BookOpen } from 'lucide-vue';

const CATEGORIES = [
  'redaction',
  'qc',
  'design',
  'html_integration',
  'deliverability',
  'translation',
  'other',
];
const STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

export default {
  name: 'BsAiExpertiseTab',
  components: {
    BsDataTable,
    BsAiExpertiseCreateModal,
    BsTimestamp,
    LucideBookOpen: BookOpen,
  },
  data() {
    return {
      loading: false,
      items: [],
      total: 0,
      saving: false,
      search: '',
      filterCategory: null,
      filterStatus: null,
      filterScope: null,
    };
  },
  computed: {
    categoryOptions() {
      return CATEGORIES.map((value) => ({
        value,
        text: this.$t(`aiSkills.categories.${value}`),
      }));
    },
    statusOptions() {
      return STATUSES.map((value) => ({
        value,
        text: this.$t(`aiSkills.statuses.${value}`),
      }));
    },
    // Scope values present in the loaded list — drives the scope filter.
    scopeOptions() {
      const set = new Set();
      for (const e of this.items) {
        for (const s of e.scope || []) set.add(s);
      }
      return [...set].sort();
    },
    tableHeaders() {
      return [
        { text: this.$t('global.title'), value: 'title' },
        { text: this.$t('aiSkills.expertise.id'), value: 'expertiseId' },
        { text: this.$t('aiSkills.filters.category'), value: 'category' },
        { text: this.$t('global.status'), value: 'status' },
        { text: this.$t('aiSkills.expertise.scope'), value: 'scope' },
        { text: this.$t('global.updatedAt'), value: 'updatedAt' },
      ];
    },
    filteredItems() {
      // `clearable` sets this.search to null on clear — guard the trim.
      const q = (this.search || '').trim().toLowerCase();
      return this.items.filter((e) => {
        if (this.filterCategory && e.category !== this.filterCategory)
          return false;
        if (this.filterStatus && e.status !== this.filterStatus) return false;
        if (this.filterScope && !(e.scope || []).includes(this.filterScope))
          return false;
        if (q) {
          const hay = `${e.title || ''} ${e.expertiseId || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    },
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    statusColor(status) {
      return (
        { ACTIVE: 'success', DRAFT: 'warning', ARCHIVED: 'grey' }[status] ||
        'grey'
      );
    },
    categoryLabel(value) {
      return value ? this.$t(`aiSkills.categories.${value}`) : '';
    },
    statusLabel(value) {
      return value ? this.$t(`aiSkills.statuses.${value}`) : '';
    },
    openItem(item) {
      this.$router.push(`/ai-expertise/${item.expertiseId}`);
    },
    openCreate() {
      this.$refs.createModal.open();
    },
    async fetchData() {
      this.loading = true;
      try {
        const list = await this.$axios.$get(api.aiExpertiseList(), {
          params: { pageSize: 200 },
        });
        this.items = list.items || [];
        this.total = list.total || 0;
      } catch (err) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
    async createExpertise(payload) {
      this.saving = true;
      try {
        const created = await this.$axios.$post(api.aiExpertiseList(), payload);
        this.showSnackbar({
          text: this.$t('aiSkills.expertise.created'),
          color: 'success',
        });
        this.$refs.createModal.close();
        // Land on the Versions tab with the seeded v1.0 DRAFT expanded (§4),
        // parity with the skill create flow.
        const seed = (created.versions && created.versions[0]) || {};
        const expand = `${seed.versionMajor || 1}.${seed.versionMinor || 0}`;
        this.$router.push(
          `/ai-expertise/${created.expertiseId}?tab=versions&expand=${expand}`
        );
      } catch (err) {
        const msg = skillErrorMessage(this, err);
        this.showSnackbar({ text: msg, color: 'error' });
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<template>
  <div>
    <p class="tab-intro">
      {{ $t('aiSkills.expertise.intro') }}
    </p>

    <div class="filters-row">
      <v-text-field
        v-model="search"
        :label="$t('global.search')"
        prepend-inner-icon="mdi-magnify"
        dense
        outlined
        hide-details
        clearable
        class="filter-field filter-field--search"
      />
      <v-select
        v-model="filterCategory"
        :items="categoryOptions"
        item-text="text"
        item-value="value"
        :label="$t('aiSkills.filters.category')"
        dense
        outlined
        hide-details
        clearable
        class="filter-field"
      />
      <v-select
        v-model="filterStatus"
        :items="statusOptions"
        item-text="text"
        item-value="value"
        :label="$t('aiSkills.filters.status')"
        dense
        outlined
        hide-details
        clearable
        class="filter-field"
      />
      <v-select
        v-model="filterScope"
        :items="scopeOptions"
        :label="$t('aiSkills.expertise.scope')"
        dense
        outlined
        hide-details
        clearable
        class="filter-field"
      />
    </div>

    <bs-data-table
      :headers="tableHeaders"
      :items="filteredItems"
      :loading="loading"
      item-key="expertiseId"
      clickable
      @click:row="openItem"
    >
      <template #item.title="{ item }">
        <span class="font-weight-medium">{{ item.title }}</span>
      </template>
      <template #item.expertiseId="{ item }">
        <span class="text-caption text--secondary">{{ item.expertiseId }}</span>
      </template>
      <template #item.category="{ item }">
        <v-chip small color="grey lighten-3" class="category-chip">
          {{ categoryLabel(item.category) }}
        </v-chip>
      </template>
      <template #item.status="{ item }">
        <v-chip
          small
          :color="statusColor(item.status)"
          :outlined="item.status !== 'ACTIVE'"
          :dark="item.status === 'ACTIVE'"
        >
          {{ statusLabel(item.status) }}
        </v-chip>
      </template>
      <template #item.scope="{ item }">
        <v-chip v-if="item.isTransversal" x-small outlined color="primary">
          {{ $t('aiSkills.expertise.transversalChip') }}
        </v-chip>
        <span v-else-if="item.scope && item.scope.length">{{
          item.scope.join(', ')
        }}</span>
        <v-tooltip v-else bottom>
          <template #activator="{ on, attrs }">
            <span class="text--disabled" v-bind="attrs" v-on="on">—</span>
          </template>
          <span>{{ $t('aiSkills.expertise.noScopeTooltip') }}</span>
        </v-tooltip>
      </template>
      <template #item.updatedAt="{ item }">
        <bs-timestamp :value="item.updatedAt" />
      </template>
      <template #no-data>
        <div class="text-center pa-6">
          <lucide-book-open :size="48" class="grey--text text--lighten-1" />
          <p class="text-body-1 grey--text mt-4">
            {{ $t('aiSkills.expertise.noExpertise') }}
          </p>
        </div>
      </template>
    </bs-data-table>

    <bs-ai-expertise-create-modal
      ref="createModal"
      :loading="saving"
      @submit="createExpertise"
    />
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
  flex-wrap: wrap;
}
.filter-field {
  max-width: 220px;
}
.filter-field--search {
  max-width: 280px;
}
.category-chip {
  color: rgba(0, 0, 0, 0.75);
}
</style>
