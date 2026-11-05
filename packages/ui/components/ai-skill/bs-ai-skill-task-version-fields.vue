<script>
// What a task skill's version holds (ADR 0013): the procedure an assistant
// follows, and the expertises it consumes, in the order it reads them. The
// panel owns the draft; this component only emits the new values.
//
// The editor reads the expertises, whatever their status, up to a page of
// them, and offers the published ones. A consumed one says what keeps it from
// an assistant: not found (no such id among those read), not published (a
// draft, or archived), or kept to the platform company.
import BsTextarea from '~/components/form/bs-textarea.vue';
import { aiExpertiseList } from '~/helpers/ai-skill-routes.js';
import {
  MAX_CONSUMED_EXPERTISES,
  CONSUMED_STATES,
  consumedRows,
  addableExpertises,
  withConsumed,
  moveConsumed,
} from '~/helpers/ai-skill-consumed-expertises.js';
import { ChevronUp, ChevronDown, X } from 'lucide-vue';

// The expertises the editor reads, at most: the list route's page.
const EXPERTISES_PAGE_SIZE = 200;

// The label and the help of each state, under aiSkills.version.
const STATE_KEYS = Object.freeze({
  [CONSUMED_STATES.NOT_FOUND]: 'consumedExpertiseNotFound',
  [CONSUMED_STATES.NOT_PUBLISHED]: 'consumedExpertiseNotPublished',
  [CONSUMED_STATES.PLATFORM_ONLY]: 'consumedExpertisePlatformOnly',
});

export default {
  name: 'BsAiSkillTaskVersionFields',
  components: {
    BsTextarea,
    LucideChevronUp: ChevronUp,
    LucideChevronDown: ChevronDown,
    LucideX: X,
  },
  props: {
    procedure: { type: String, default: '' },
    consumedExpertiseIds: { type: Array, default: () => [] },
    readonly: { type: Boolean, default: false },
  },
  data() {
    return {
      expertises: [],
      loaded: false,
      loading: false,
      loadError: false,
      // Reset after each pick, so the field is ready for the next one.
      picked: null,
    };
  },
  computed: {
    rows() {
      return consumedRows(
        this.consumedExpertiseIds,
        this.expertises,
        this.loaded
      );
    },
    addableItems() {
      return addableExpertises(this.expertises, this.consumedExpertiseIds);
    },
    full() {
      return this.consumedExpertiseIds.length >= MAX_CONSUMED_EXPERTISES;
    },
    maxHint() {
      return this.$t('aiSkills.version.consumedExpertisesMax', {
        max: MAX_CONSUMED_EXPERTISES,
      });
    },
  },
  mounted() {
    this.loadExpertises();
  },
  methods: {
    async loadExpertises() {
      this.loading = true;
      this.loadError = false;
      try {
        const list = await this.$axios.$get(aiExpertiseList(), {
          params: { pageSize: EXPERTISES_PAGE_SIZE },
        });
        this.expertises = list.items || [];
        this.loaded = true;
      } catch (err) {
        this.expertises = [];
        this.loadError = true;
      } finally {
        this.loading = false;
      }
    },
    emitIds(ids) {
      this.$emit('update:consumedExpertiseIds', ids);
    },
    stateLabel(state) {
      return this.$t(`aiSkills.version.${STATE_KEYS[state]}`);
    },
    stateHint(state) {
      return this.$t(`aiSkills.version.${STATE_KEYS[state]}Hint`);
    },
    add(expertiseId) {
      const ids = withConsumed(this.consumedExpertiseIds, expertiseId);
      if (ids.length !== this.consumedExpertiseIds.length) this.emitIds(ids);
      this.$nextTick(() => {
        this.picked = null;
      });
    },
    remove(index) {
      this.emitIds(this.consumedExpertiseIds.filter((_, i) => i !== index));
    },
    move(index, offset) {
      this.emitIds(moveConsumed(this.consumedExpertiseIds, index, offset));
    },
  },
};
</script>

<template>
  <div>
    <bs-textarea
      :value="procedure"
      :label="$t('aiSkills.version.procedure')"
      :hint="$t('aiSkills.version.procedureHint')"
      persistent-hint
      :rows="10"
      :readonly="readonly"
      monospace
      @input="$emit('update:procedure', $event)"
    />
    <div class="mt-4">
      <div class="text-subtitle-2">
        {{ $t('aiSkills.version.consumedExpertises') }}
      </div>
      <p class="text-caption text--secondary mb-2">
        {{ $t('aiSkills.version.consumedExpertisesHint') }}
      </p>
      <v-alert v-if="loadError" type="error" dense outlined class="mb-2">
        <div class="d-flex align-center">
          <span>{{ $t('aiSkills.version.consumedExpertisesLoadError') }}</span>
          <v-spacer />
          <v-btn text small color="error" @click="loadExpertises">
            {{ $t('aiSkills.version.consumedExpertisesRetry') }}
          </v-btn>
        </div>
      </v-alert>
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
      <v-autocomplete
        v-if="!readonly"
        v-model="picked"
        :items="addableItems"
        :label="$t('aiSkills.version.consumedExpertisesAdd')"
        :loading="loading"
        :disabled="full || loadError"
        :hint="full ? maxHint : ''"
        persistent-hint
        outlined
        dense
        class="mt-3"
        @change="add"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.consumed-list code {
  font-size: 0.72rem;
  background: none;
  padding: 0;
}
</style>
