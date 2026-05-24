<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as api from '~/helpers/ai-skill-routes.js';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import { History } from 'lucide-vue';

const STATUSES = [
  'SUCCESS',
  'VALIDATION_ERROR',
  'PROVIDER_ERROR',
  'TIMEOUT',
  'CANCELLED',
  'CONFIG_ERROR',
];

export default {
  name: 'BsAiInvocationsTab',
  components: {
    BsDataTable,
    BsModalConfirm,
    LucideHistory: History,
  },
  data() {
    return {
      loading: false,
      items: [],
      total: 0,
      filters: {
        skillId: '',
        featureType: '',
        status: null,
        groupId: '',
        startedFrom: null,
        startedTo: null,
      },
      // Hides non-productive invocations (admin-test, playground) by default.
      includeNonProd: false,
      dateFromMenu: false,
      dateToMenu: false,
      detail: null,
    };
  },
  computed: {
    statusOptions() {
      return STATUSES.map((value) => ({
        value,
        text: this.$t(`aiSkills.statuses.${value}`),
      }));
    },
    /**
     * Non-productive featureTypes ('admin-test', 'playground') are excluded
     * client-side by default. The toggle lets a super-admin opt-in to seeing
     * them when debugging the test runner or the playground itself.
     */
    visibleItems() {
      if (this.includeNonProd) return this.items;
      return this.items.filter(
        (i) => i.featureType !== 'admin-test' && i.featureType !== 'playground'
      );
    },
    tableHeaders() {
      return [
        { text: this.$t('aiSkills.invocation.when'), value: 'startedAt' },
        { text: this.$t('aiSkills.filters.skillId'), value: 'skillId' },
        {
          text: this.$t('aiSkills.invocation.version'),
          value: 'skillVersion',
          align: 'center',
        },
        { text: this.$t('aiSkills.invocation.feature'), value: 'featureType' },
        { text: this.$t('aiSkills.invocation.group'), value: 'group' },
        { text: this.$t('global.status'), value: 'status' },
        {
          text: this.$t('aiSkills.invocation.latency'),
          value: 'latencyMs',
          align: 'right',
        },
        {
          text: this.$t('aiSkills.invocation.tokens'),
          value: 'tokens',
          align: 'right',
        },
        {
          text: this.$t('aiSkills.invocation.providerModel'),
          value: 'provider',
        },
      ];
    },
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    statusLabel(value) {
      return value ? this.$t(`aiSkills.statuses.${value}`) : '';
    },
    groupName(item) {
      if (!item._company) return '—';
      if (typeof item._company === 'object') return item._company.name || '—';
      return String(item._company);
    },
    totalTokens(item) {
      const u = item.tokenUsage || {};
      const total = (u.promptTokens || 0) + (u.completionTokens || 0);
      return total || null;
    },
    async fetchData() {
      this.loading = true;
      try {
        const params = {};
        for (const [k, v] of Object.entries(this.filters)) {
          if (!v) continue;
          if (k === 'startedTo') {
            // Include the whole "to" day, until 23:59:59.999.
            const d = new Date(v);
            d.setHours(23, 59, 59, 999);
            params.startedTo = d.toISOString();
          } else if (k === 'startedFrom') {
            params.startedFrom = new Date(v).toISOString();
          } else {
            params[k] = v;
          }
        }
        const res = await this.$axios.$get(api.aiInvocations(), { params });
        this.items = res.items || [];
        this.total = res.total || 0;
      } catch (err) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
    async openDetail(item) {
      try {
        this.detail = await this.$axios.$get(api.aiInvocation(item._id));
        this.$refs.detailModal.open();
      } catch (err) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
    statusColor(status) {
      return status === 'SUCCESS' ? 'success' : 'error';
    },
    formatDate(d) {
      return d ? new Date(d).toLocaleString() : '';
    },
  },
};
</script>

<template>
  <div>
    <p class="tab-intro">
      {{ $t('aiSkills.invocation.intro') }}
    </p>

    <div class="filters-row">
      <v-text-field
        v-model="filters.skillId"
        :label="$t('aiSkills.filters.skillId')"
        dense
        outlined
        hide-details
        clearable
        class="filter-field"
        @change="fetchData"
      />
      <v-text-field
        v-model="filters.featureType"
        :label="$t('aiSkills.filters.feature')"
        dense
        outlined
        hide-details
        clearable
        class="filter-field"
        @change="fetchData"
      />
      <v-select
        v-model="filters.status"
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
      <v-text-field
        v-model="filters.groupId"
        :label="$t('aiSkills.filters.groupId')"
        dense
        outlined
        hide-details
        clearable
        class="filter-field"
        @change="fetchData"
      />
      <v-checkbox
        v-model="includeNonProd"
        :label="$t('aiSkills.invocation.includeNonProd')"
        dense
        hide-details
        class="filter-toggle"
      />
      <v-menu
        v-model="dateFromMenu"
        :close-on-content-click="false"
        offset-y
        min-width="auto"
      >
        <template #activator="{ on, attrs }">
          <v-text-field
            v-model="filters.startedFrom"
            :label="$t('aiSkills.invocation.dateFrom')"
            dense
            outlined
            hide-details
            clearable
            readonly
            class="filter-field"
            v-bind="attrs"
            v-on="on"
            @click:clear="
              filters.startedFrom = null;
              fetchData();
            "
          />
        </template>
        <v-date-picker
          v-model="filters.startedFrom"
          no-title
          @input="
            dateFromMenu = false;
            fetchData();
          "
        />
      </v-menu>
      <v-menu
        v-model="dateToMenu"
        :close-on-content-click="false"
        offset-y
        min-width="auto"
      >
        <template #activator="{ on, attrs }">
          <v-text-field
            v-model="filters.startedTo"
            :label="$t('aiSkills.invocation.dateTo')"
            dense
            outlined
            hide-details
            clearable
            readonly
            class="filter-field"
            v-bind="attrs"
            v-on="on"
            @click:clear="
              filters.startedTo = null;
              fetchData();
            "
          />
        </template>
        <v-date-picker
          v-model="filters.startedTo"
          no-title
          @input="
            dateToMenu = false;
            fetchData();
          "
        />
      </v-menu>
    </div>

    <bs-data-table
      :headers="tableHeaders"
      :items="visibleItems"
      :loading="loading"
      item-key="_id"
      clickable
      @click:row="openDetail"
    >
      <template #item.startedAt="{ item }">
        <span class="text-caption">{{ formatDate(item.startedAt) }}</span>
      </template>
      <template #item.skillId="{ item }">
        <span class="font-weight-medium">{{ item.skillId }}</span>
      </template>
      <template #item.skillVersion="{ item }">
        <span v-if="item.skillVersion">v{{ item.skillVersion }}</span>
      </template>
      <template #item.status="{ item }">
        <v-chip
          small
          :color="statusColor(item.status)"
          :outlined="item.status !== 'SUCCESS'"
          :dark="item.status === 'SUCCESS'"
        >
          {{ statusLabel(item.status) }}
        </v-chip>
      </template>
      <template #item.latencyMs="{ item }">
        <span v-if="item.latencyMs != null">{{ item.latencyMs }} ms</span>
      </template>
      <template #item.group="{ item }">
        <span class="text-caption">{{ groupName(item) }}</span>
      </template>
      <template #item.tokens="{ item }">
        <span v-if="totalTokens(item)" class="text-caption">{{
          totalTokens(item)
        }}</span>
        <span v-else class="text--disabled">—</span>
      </template>
      <template #item.provider="{ item }">
        <span class="text-caption">
          {{ item.provider || '—' }}
          <span v-if="item.model" class="text--secondary"
            >· {{ item.model }}</span
          >
        </span>
      </template>
      <template #no-data>
        <div class="text-center pa-6">
          <lucide-history :size="48" class="grey--text text--lighten-1" />
          <p class="text-body-1 grey--text mt-4 mb-1">
            {{ $t('aiSkills.invocation.noInvocations') }}
          </p>
          <p class="text-caption text--secondary">
            {{ $t('aiSkills.invocation.noInvocationsHint') }}
          </p>
        </div>
      </template>
    </bs-data-table>

    <bs-modal-confirm
      ref="detailModal"
      :title="detail ? detail.skillId + ' · v' + detail.skillVersion : ''"
      :is-form="true"
      modal-width="800"
    >
      <div v-if="detail">
        <p class="mb-2">
          <v-chip
            small
            :color="statusColor(detail.status)"
            :dark="detail.status === 'SUCCESS'"
            :outlined="detail.status !== 'SUCCESS'"
          >
            {{ statusLabel(detail.status) }}
          </v-chip>
          <span class="text-caption ml-2"
            >{{ detail.latencyMs }} ms · {{ detail.provider }} ·
            {{ detail.model }}</span
          >
        </p>
        <v-alert v-if="detail.error" type="error" dense outlined class="mb-3">
          <strong>{{ detail.error.code }}</strong> — {{ detail.error.message }}
        </v-alert>
        <div v-if="detail.input" class="mt-3">
          <div class="text-overline">
            {{ $t('aiSkills.invocation.detailInput') }}
          </div>
          <pre class="code-block">{{
            JSON.stringify(detail.input, null, 2)
          }}</pre>
        </div>
        <div v-if="detail.output" class="mt-3">
          <div class="text-overline">
            {{ $t('aiSkills.invocation.detailOutput') }}
          </div>
          <pre class="code-block">{{
            JSON.stringify(detail.output, null, 2)
          }}</pre>
        </div>
        <div v-if="detail.resolvedConfig" class="mt-3">
          <div class="text-overline">
            {{ $t('aiSkills.invocation.detailResolvedConfig') }}
          </div>
          <pre class="code-block">{{
            JSON.stringify(detail.resolvedConfig, null, 2)
          }}</pre>
        </div>
      </div>
      <v-divider class="mt-4" />
      <div class="modal-actions">
        <v-btn text color="primary" @click="$refs.detailModal.close()">
          {{ $t('global.close') }}
        </v-btn>
      </div>
    </bs-modal-confirm>
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
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0 0;
}
.code-block {
  background: #f5f5f5;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  max-height: 240px;
  overflow: auto;
  margin: 0.25rem 0 0;
}
</style>
