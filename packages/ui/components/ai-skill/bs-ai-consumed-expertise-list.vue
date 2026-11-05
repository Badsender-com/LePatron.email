<script>
// The expertises a task skill's version consumes, in the order an assistant
// reads them, each with what keeps it from an assistant, if anything. The
// rows come from consumedRows (helpers/ai-skill-consumed-expertises.js);
// moving or removing one is emitted, the version's fields own the list.
import { CONSUMED_STATES } from '~/helpers/ai-skill-consumed-expertises.js';
import { ChevronUp, ChevronDown, X } from 'lucide-vue';

// The label and the help of each state, under aiSkills.version.
const STATE_KEYS = Object.freeze({
  [CONSUMED_STATES.NOT_FOUND]: 'consumedExpertiseNotFound',
  [CONSUMED_STATES.NOT_PUBLISHED]: 'consumedExpertiseNotPublished',
  [CONSUMED_STATES.PLATFORM_ONLY]: 'consumedExpertisePlatformOnly',
});

export default {
  name: 'BsAiConsumedExpertiseList',
  components: {
    LucideChevronUp: ChevronUp,
    LucideChevronDown: ChevronDown,
    LucideX: X,
  },
  props: {
    rows: { type: Array, default: () => [] },
    readonly: { type: Boolean, default: false },
  },
  methods: {
    stateLabel(state) {
      return this.$t(`aiSkills.version.${STATE_KEYS[state]}`);
    },
    stateHint(state) {
      return this.$t(`aiSkills.version.${STATE_KEYS[state]}Hint`);
    },
    move(index, offset) {
      this.$emit('move', index, offset);
    },
    remove(index) {
      this.$emit('remove', index);
    },
  },
};
</script>

<template>
  <v-list v-if="rows.length" dense outlined class="py-0 consumed-list">
    <v-list-item v-for="(row, index) in rows" :key="row.id">
      <span class="text-caption text--secondary mr-3">{{ index + 1 }}</span>
      <v-list-item-content>
        <v-list-item-title>
          {{ row.title || row.id }}
          <v-chip
            v-if="row.state"
            x-small
            outlined
            color="warning"
            class="ml-2"
          >
            {{ stateLabel(row.state) }}
          </v-chip>
        </v-list-item-title>
        <v-list-item-subtitle v-if="row.title">
          <code>{{ row.id }}</code>
        </v-list-item-subtitle>
        <v-list-item-subtitle v-if="row.state" class="text-wrap">
          {{ stateHint(row.state) }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action v-if="!readonly" class="flex-row align-center">
        <v-tooltip top>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              :disabled="index === 0"
              :aria-label="$t('aiSkills.version.consumedExpertiseUp')"
              v-bind="attrs"
              v-on="on"
              @click="move(index, -1)"
            >
              <lucide-chevron-up :size="16" />
            </v-btn>
          </template>
          <span>{{ $t('aiSkills.version.consumedExpertiseUp') }}</span>
        </v-tooltip>
        <v-tooltip top>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              :disabled="index === rows.length - 1"
              :aria-label="$t('aiSkills.version.consumedExpertiseDown')"
              v-bind="attrs"
              v-on="on"
              @click="move(index, 1)"
            >
              <lucide-chevron-down :size="16" />
            </v-btn>
          </template>
          <span>{{ $t('aiSkills.version.consumedExpertiseDown') }}</span>
        </v-tooltip>
        <v-tooltip top>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              class="error--text"
              :aria-label="$t('aiSkills.version.consumedExpertiseRemove')"
              v-bind="attrs"
              v-on="on"
              @click="remove(index)"
            >
              <lucide-x :size="16" />
            </v-btn>
          </template>
          <span>{{ $t('aiSkills.version.consumedExpertiseRemove') }}</span>
        </v-tooltip>
      </v-list-item-action>
    </v-list-item>
  </v-list>
  <p v-else class="text-body-2 text--secondary mb-0">
    {{ $t('aiSkills.version.consumedExpertisesEmpty') }}
  </p>
</template>

<style lang="scss" scoped>
.consumed-list code {
  font-size: 0.72rem;
  background: none;
  padding: 0;
}
</style>
