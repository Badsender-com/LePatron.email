<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as api from '~/helpers/ai-skill-routes.js';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsAiExpertiseCreateModal from '~/components/ai-skill/BsAiExpertiseCreateModal.vue';
import { BookOpen } from 'lucide-vue';

export default {
  name: 'BsAiExpertiseTab',
  components: {
    BsDataTable,
    BsAiExpertiseCreateModal,
    LucideBookOpen: BookOpen,
  },
  data() {
    return {
      loading: false,
      items: [],
      total: 0,
      saving: false,
    };
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('aiSkills.expertise.id'), value: 'expertiseId' },
        { text: this.$t('global.title'), value: 'title' },
        { text: this.$t('aiSkills.filters.category'), value: 'category' },
        { text: this.$t('global.status'), value: 'status' },
        { text: this.$t('aiSkills.expertise.scope'), value: 'scope' },
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
    openItem(item) {
      this.$router.push(`/ai-expertise/${item.expertiseId}`);
    },
    openCreate() {
      this.$refs.createModal.open();
    },
    async fetchData() {
      this.loading = true;
      try {
        const list = await this.$axios.$get(api.aiExpertiseList());
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
        this.$router.push(`/ai-expertise/${created.expertiseId}`);
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
      {{ $t('aiSkills.expertise.intro') }}
    </p>

    <bs-data-table
      :headers="tableHeaders"
      :items="items"
      :loading="loading"
      item-key="expertiseId"
      clickable
      @click:row="openItem"
    >
      <template #item.expertiseId="{ item }">
        <span class="font-weight-medium">{{ item.expertiseId }}</span>
      </template>
      <template #item.category="{ item }">
        <v-chip x-small outlined color="grey">
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
        <span v-if="item.scope && item.scope.length">{{
          item.scope.join(', ')
        }}</span>
        <span v-else class="text--disabled">—</span>
      </template>
      <template #item.updatedAt="{ item }">
        <span class="text-caption text--secondary">{{
          formatDate(item.updatedAt)
        }}</span>
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
</style>
