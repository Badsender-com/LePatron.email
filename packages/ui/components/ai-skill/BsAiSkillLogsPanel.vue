<script>
import * as api from '~/helpers/ai-skill-routes.js';
import BsDataTable from '~/components/data-table/bs-data-table.vue';

export default {
  name: 'BsAiSkillLogsPanel',
  components: { BsDataTable },
  props: {
    skillId: { type: String, required: true },
  },
  data() {
    // A skill's own Logs tab shows ALL featureTypes by default — seeing this
    // skill's playground runs is precisely the point here (unlike the global
    // Invocations tab, which keeps the analytics exclusion). The toggle
    // re-applies the exclusion on demand.
    return { items: [], loading: false, hideTest: false };
  },
  computed: {
    headers() {
      return [
        { text: this.$t('aiSkills.invocation.when'), value: 'startedAt' },
        {
          text: this.$t('aiSkills.invocation.version'),
          value: 'skillVersion',
          align: 'center',
        },
        { text: this.$t('aiSkills.invocation.feature'), value: 'featureType' },
        { text: this.$t('global.status'), value: 'status' },
        {
          text: this.$t('aiSkills.invocation.latency'),
          value: 'latencyMs',
          align: 'right',
        },
      ];
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    formatDate(d) {
      return d ? new Date(d).toLocaleString() : '';
    },
    statusLabel(s) {
      return s ? this.$t(`aiSkills.statuses.${s}`) : '';
    },
    async load() {
      this.loading = true;
      try {
        const res = await this.$axios.$get(api.aiInvocations(), {
          params: {
            skillId: this.skillId,
            pageSize: 50,
            // Show test invocations (playground, poc.*) by default; the toggle
            // opts back into the analytics exclusion.
            includeNonProductive: !this.hideTest,
          },
        });
        this.items = res.items || [];
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <div>
    <div class="d-flex justify-end mb-2">
      <v-switch
        v-model="hideTest"
        :label="$t('aiSkills.logs.hideTest')"
        dense
        hide-details
        class="mt-0 pt-0"
        @change="load"
      />
    </div>
    <bs-data-table
      :headers="headers"
      :items="items"
      :loading="loading"
      item-key="_id"
    >
      <template #item.startedAt="{ item }">
        <span class="text-caption">{{ formatDate(item.startedAt) }}</span>
      </template>
      <template #item.skillVersion="{ item }">
        <span v-if="item.skillVersion">v{{ item.skillVersion }}</span>
      </template>
      <template #item.status="{ item }">
        <v-chip
          small
          :color="item.status === 'SUCCESS' ? 'success' : 'error'"
          :outlined="item.status !== 'SUCCESS'"
          :dark="item.status === 'SUCCESS'"
        >
          {{ statusLabel(item.status) }}
        </v-chip>
      </template>
      <template #item.latencyMs="{ item }">
        <span v-if="item.latencyMs != null">{{ item.latencyMs }} ms</span>
      </template>
      <template #no-data>
        <p class="text--disabled text-center my-4">
          {{ $t('aiSkills.logs.empty') }}
        </p>
      </template>
    </bs-data-table>
  </div>
</template>
