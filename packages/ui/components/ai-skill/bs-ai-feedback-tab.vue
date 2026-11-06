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
    return { items: [], total: 0, page: 0, loading: false, failed: false };
  },
  computed: {
    hasMore() {
      return this.items.length < this.total;
    },
  },
  mounted() {
    this.loadMore();
  },
  methods: {
    // The next page of feedbacks, after the ones shown.
    async loadMore() {
      this.loading = true;
      this.failed = false;
      try {
        const { items, total } = await this.$axios.$get('/mcp-feedbacks', {
          params: {
            kind: this.kind,
            id: this.referenceId,
            page: this.page + 1,
          },
        });
        // A feedback sent since the last page shifts the next one: what is
        // already shown is not shown twice.
        const shown = new Set(this.items.map((item) => item.id));
        this.items = [
          ...this.items,
          ...items.filter((item) => !shown.has(item.id)),
        ];
        this.total = total;
        this.page += 1;
      } catch (err) {
        this.failed = true;
      } finally {
        this.loading = false;
      }
    },
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
    <v-progress-linear
      v-if="loading && !items.length"
      indeterminate
      color="accent"
    />
    <p v-else-if="failed && !items.length" class="text-body-2 error--text">
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
            class="rating-up"
            :aria-label="$t('aiSkills.feedback.up')"
          />
          <lucide-thumbs-down
            v-else
            :size="18"
            class="rating-down"
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
    <p v-if="failed && items.length" class="text-body-2 error--text mt-2 mb-0">
      {{ $t('global.errors.errorOccured') }}
    </p>
    <div v-if="items.length" class="d-flex align-center mt-2">
      <span class="text-caption text--secondary">
        {{ $t('aiSkills.feedback.shown', { shown: items.length, total }) }}
      </span>
      <v-spacer />
      <v-btn
        v-if="hasMore"
        text
        small
        color="accent"
        :loading="loading"
        @click="loadMore"
      >
        {{ $t('aiSkills.feedback.more') }}
      </v-btn>
    </div>
  </v-card>
</template>

<style scoped>
.retex-text {
  white-space: pre-wrap;
}
/* The theme's colors, for the white label: an icon strokes its text color. */
.rating-up {
  color: var(--v-success-base);
}
.rating-down {
  color: var(--v-error-base);
}
</style>
