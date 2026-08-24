<script>
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsLatency from '~/components/bs-latency.vue';
import BsTimestamp from '~/components/bs-timestamp.vue';
import { Star, MessageSquare, Trash2 } from 'lucide-vue';

export default {
  name: 'BsAiPlaygroundRunsList',
  components: {
    BsDataTable,
    BsLatency,
    BsTimestamp,
    LucideStar: Star,
    LucideMessageSquare: MessageSquare,
    LucideTrash2: Trash2,
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
        { text: '', value: 'actions', align: 'right', sortable: false },
      ];
    },
  },
  methods: {
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
    // DELETE /runs/:runId was implemented and tested but unreachable, and its
    // confirmation key was already translated. A consultant needs it to drop a
    // botched run from a scenario's history.
    askDelete(run) {
      if (!confirm(this.$t('aiPlayground.runs.deleteConfirm'))) return;
      this.$emit('delete', run);
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
      <bs-timestamp :value="item.createdAt" />
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
    <template #item.actions="{ item }">
      <v-tooltip left>
        <template #activator="{ on, attrs }">
          <v-btn
            icon
            small
            v-bind="attrs"
            v-on="on"
            @click.stop="askDelete(item)"
          >
            <lucide-trash2 :size="16" class="text--secondary" />
          </v-btn>
        </template>
        <span>{{ $t('aiPlayground.runs.delete') }}</span>
      </v-tooltip>
    </template>
    <template #no-data>
      <p class="text--disabled text-center my-4">
        {{ $t('aiPlayground.runs.empty') }}
      </p>
    </template>
  </bs-data-table>
</template>
