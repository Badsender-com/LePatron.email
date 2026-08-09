<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as api from '~/helpers/ai-skill-routes.js';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsAiSkillCreateModal from '~/components/ai-skill/BsAiSkillCreateModal.vue';
import BsTimestamp from '~/components/ai-skill/BsTimestamp.vue';
import { Sparkles } from 'lucide-vue';

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
  name: 'BsAiSkillsTab',
  components: {
    BsDataTable,
    BsAiSkillCreateModal,
    BsTimestamp,
    LucideSparkles: Sparkles,
  },
  data() {
    return {
      loading: false,
      items: [],
      total: 0,
      filterCategory: null,
      filterStatus: null,
      schemas: [],
      saving: false,
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
    tableHeaders() {
      return [
        { text: this.$t('aiSkills.skill.id'), value: 'skillId' },
        { text: this.$t('global.title'), value: 'title' },
        { text: this.$t('aiSkills.filters.category'), value: 'category' },
        { text: this.$t('global.status'), value: 'status' },
        {
          text: this.$t('aiSkills.skill.activeVersion'),
          value: 'activeVersion',
          align: 'center',
        },
        { text: this.$t('global.updatedAt'), value: 'updatedAt' },
      ];
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
    formatDate(d) {
      return d ? new Date(d).toLocaleString() : '';
    },
    openSkill(item) {
      this.$router.push(`/ai-skills/${item.skillId}`);
    },
    openCreate() {
      this.$refs.createModal.open();
    },
    async fetchData() {
      this.loading = true;
      try {
        const params = {};
        if (this.filterCategory) params.category = this.filterCategory;
        if (this.filterStatus) params.status = this.filterStatus;
        const [list, schemasRes] = await Promise.all([
          this.$axios.$get(api.aiSkills(), { params }),
          this.$axios.$get(api.aiSkillSchemas()),
        ]);
        this.items = list.items || [];
        this.total = list.total || 0;
        this.schemas = schemasRes.schemas || [];
      } catch (err) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
    async createSkill(payload) {
      this.saving = true;
      try {
        const created = await this.$axios.$post(api.aiSkills(), payload);
        this.showSnackbar({
          text: this.$t('aiSkills.skill.created'),
          color: 'success',
        });
        this.$refs.createModal.close();
        this.$router.push(`/ai-skills/${created.skillId}`);
      } catch (err) {
        const msg =
          (err.response && err.response.data && err.response.data.message) ||
          this.$t('global.errors.errorOccured');
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
      {{ $t('aiSkills.skill.intro') }}
    </p>

    <div class="filters-row">
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
        @change="fetchData"
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
        @change="fetchData"
      />
    </div>

    <bs-data-table
      :headers="tableHeaders"
      :items="items"
      :loading="loading"
      item-key="skillId"
      clickable
      @click:row="openSkill"
    >
      <template #item.skillId="{ item }">
        <span class="font-weight-medium">{{ item.skillId }}</span>
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
      <template #item.category="{ item }">
        <v-chip x-small outlined color="grey">
          {{ categoryLabel(item.category) }}
        </v-chip>
      </template>
      <template #item.activeVersion="{ item }">
        <span v-if="item.activeVersion && item.activeVersion.major != null">
          v{{ item.activeVersion.major }}.{{ item.activeVersion.minor || 0 }}
        </span>
        <span v-else class="text--disabled">—</span>
      </template>
      <template #item.updatedAt="{ item }">
        <bs-timestamp :value="item.updatedAt" />
      </template>
      <template #no-data>
        <div class="text-center pa-6">
          <lucide-sparkles :size="48" class="grey--text text--lighten-1" />
          <p class="text-body-1 grey--text mt-4">
            {{ $t('aiSkills.skill.noSkills') }}
          </p>
        </div>
      </template>
    </bs-data-table>

    <bs-ai-skill-create-modal
      ref="createModal"
      :schemas="schemas"
      :loading="saving"
      @submit="createSkill"
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
}
.filter-field {
  max-width: 220px;
}
</style>
