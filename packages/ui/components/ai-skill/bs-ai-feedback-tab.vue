<script>
// The feedbacks sent from connected applications on one skill or expertise
// (ADR 0012), with the version they were given on and the retex when the group
// and the user agreed to share it. Read by super admins, to improve the skill.
import BsTimestamp from '~/components/bs-timestamp.vue';
import { ThumbsUp, ThumbsDown } from 'lucide-vue';

export default {
  name: 'BsAiFeedbackTab',
  components: {
    BsTimestamp,
    LucideThumbsUp: ThumbsUp,
    LucideThumbsDown: ThumbsDown,
  },
  props: {
    kind: { type: String, required: true },
    referenceId: { type: String, required: true },
  },
  data() {
    return { items: [], loading: false, failed: false };
  },
  async mounted() {
    this.loading = true;
    try {
      const { items } = await this.$axios.$get('/mcp-feedbacks', {
        params: { kind: this.kind, id: this.referenceId },
      });
      this.items = items;
    } catch (err) {
      this.failed = true;
    } finally {
      this.loading = false;
    }
  },
  methods: {
    versionOf(item) {
      const reference = item.references.find(
        (r) => r.kind === this.kind && r.id === this.referenceId
      );
      return reference && reference.version ? `v${reference.version}` : '—';
    },
  },
};
</script>

<template>
  <v-card outlined class="pa-4">
    <p class="text-caption text--secondary mb-3">
      {{ $t('aiSkills.feedback.caption') }}
    </p>
    <v-progress-linear v-if="loading" indeterminate color="accent" />
    <p v-else-if="failed" class="text-body-2 error--text">
      {{ $t('global.errors.errorOccured') }}
    </p>
    <p v-else-if="!items.length" class="text-body-2 text--secondary">
      {{ $t('aiSkills.feedback.empty') }}
    </p>
    <v-list v-else dense>
      <v-list-item v-for="item in items" :key="item.id" class="feedback-row">
        <v-list-item-icon class="mr-3">
          <lucide-thumbs-up
            v-if="item.rating === 'up'"
            :size="18"
            color="#4caf50"
            :aria-label="$t('aiSkills.feedback.up')"
          />
          <lucide-thumbs-down
            v-else
            :size="18"
            color="#e53935"
            :aria-label="$t('aiSkills.feedback.down')"
          />
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title class="text-body-2">
            {{ item.comment || $t('aiSkills.feedback.noComment') }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ item.group.name }} · {{ versionOf(item) }} ·
            <bs-timestamp :value="item.createdAt" />
          </v-list-item-subtitle>
          <details v-if="item.retex" class="mt-2 text-body-2">
            <summary>{{ $t('aiSkills.feedback.retex') }}</summary>
            <p class="mt-1 mb-0 retex-text">{{ item.retex }}</p>
          </details>
        </v-list-item-content>
      </v-list-item>
    </v-list>
  </v-card>
</template>

<style scoped>
.retex-text {
  white-space: pre-wrap;
}
</style>
