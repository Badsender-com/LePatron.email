<script>
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsLatency from '~/components/bs-latency.vue';
import { Star, MessageSquare } from 'lucide-vue';

export default {
  name: 'BsAiPlaygroundRunsList',
  components: {
    BsDataTable,
    BsLatency,
    LucideStar: Star,
    LucideMessageSquare: MessageSquare,
  },
  props: {
    runs: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },
  computed: {
    headers() {
      return [
        { text: this.$t('aiPlayground.headers.when'), value: 'createdAt' },
        { text: this.$t('aiPlayground.headers.status'), value: 'status' },
        {
          text: this.$t('aiPlayground.headers.latency'),
          value: 'latencyMs',
          align: 'right',
        },
        {
          text: this.$t('aiPlayground.headers.tokens'),
          value: 'tokens',
          align: 'right',
        },
        {
          text: this.$t('aiPlayground.headers.golden'),
          value: 'isGolden',
          align: 'center',
        },
        {
          text: this.$t('aiPlayground.headers.feedback'),
          value: 'feedback',
          align: 'center',
        },
      ];
    },
  },
  methods: {
    formatDate(d) {
      return d ? new Date(d).toLocaleString() : '';
    },
    statusColor(s) {
      return s === 'SUCCESS' ? 'success' : 'error';
    },
    statusLabel(s) {
      return s ? this.$t(`aiPlayground.status.${s}`) : '';
    },
    totalTokens(run) {
      const u = (run && run.tokenUsage) || {};
      return (u.promptTokens || 0) + (u.completionTokens || 0);
    },
    openRun(run) {
      this.$emit('open', run);
    },
  },
};
</script>

<template>
  <bs-data-table
    :headers="headers"
    :items="runs"
    :loading="loading"
    item-key="_id"
    clickable
    @click:row="openRun"
  >
    <template #item.createdAt="{ item }">
      <span class="text-caption">{{ formatDate(item.createdAt) }}</span>
    </template>
    <template #item.status="{ item }">
      <v-chip
        small
        :color="statusColor(item.status)"
        :dark="item.status === 'SUCCESS'"
        :outlined="item.status !== 'SUCCESS'"
      >
        {{ statusLabel(item.status) }}
      </v-chip>
    </template>
    <template #item.latencyMs="{ item }">
      <bs-latency :value="item.latencyMs" />
    </template>
    <template #item.tokens="{ item }">
      <span v-if="totalTokens(item)" class="text-caption">{{
        totalTokens(item)
      }}</span>
      <span v-else class="text--disabled">—</span>
    </template>
    <template #item.isGolden="{ item }">
      <lucide-star
        v-if="item.isGolden"
        :size="16"
        class="accent--text"
        fill="currentColor"
      />
    </template>
    <template #item.feedback="{ item }">
      <lucide-message-square
        v-if="item.feedback && item.feedback.rating"
        :size="16"
        class="text--secondary"
      />
    </template>
    <template #no-data>
      <p class="text--disabled text-center my-4">
        {{ $t('aiPlayground.runs.empty') }}
      </p>
    </template>
  </bs-data-table>
</template>
