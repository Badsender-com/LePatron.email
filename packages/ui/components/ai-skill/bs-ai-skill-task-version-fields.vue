<script>
// What a task skill's version holds (ADR 0013): the procedure an assistant
// follows, and the expertises it consumes, in the order it reads them. The
// panel owns the draft; this component only emits the new values.
//
// The consumed expertises are read by id, whatever their status, so each one
// says what keeps it from an assistant: not found (no expertise has that id),
// not published (a draft, or archived), or kept to the platform company. One
// is added by a search of the published ones, on the server.
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsAiConsumedExpertiseList from '~/components/ai-skill/bs-ai-consumed-expertise-list.vue';
import { aiExpertiseList } from '~/helpers/ai-skill-routes.js';
import {
  MAX_CONSUMED_EXPERTISES,
  consumedRows,
  idsToRead,
  searchParams,
  withRead,
  addableExpertises,
  withConsumed,
  moveConsumed,
} from '~/helpers/ai-skill-consumed-expertises.js';

// How long the search waits for the typing to pause.
const SEARCH_DELAY_MS = 300;

export default {
  name: 'BsAiSkillTaskVersionFields',
  components: { BsTextarea, BsAiConsumedExpertiseList },
  props: {
    procedure: { type: String, default: '' },
    consumedExpertiseIds: { type: Array, default: () => [] },
    readonly: { type: Boolean, default: false },
  },
  data() {
    return {
      // The expertises read, consumed or found, and the ids asked for.
      expertises: [],
      readIds: [],
      loadError: false,
      results: [],
      search: null,
      searching: false,
      searchError: false,
      // Only the answer to the latest search is shown.
      searchCount: 0,
      // Reset after each pick, so the field is ready for the next one.
      picked: null,
    };
  },
  computed: {
    rows() {
      return consumedRows(
        this.consumedExpertiseIds,
        this.expertises,
        this.readIds
      );
    },
    addableItems() {
      return addableExpertises(this.results, this.consumedExpertiseIds);
    },
    full() {
      return this.consumedExpertiseIds.length >= MAX_CONSUMED_EXPERTISES;
    },
    hint() {
      return this.full
        ? this.$t('aiSkills.version.consumedExpertisesMax', {
            max: MAX_CONSUMED_EXPERTISES,
          })
        : '';
    },
  },
  watch: {
    consumedExpertiseIds: { handler: 'readConsumed', immediate: true },
    search(text) {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(
        () => this.runSearch(text),
        SEARCH_DELAY_MS
      );
    },
  },
  beforeDestroy() {
    clearTimeout(this.searchTimer);
  },
  methods: {
    async readConsumed() {
      const ids = idsToRead(this.consumedExpertiseIds, this.readIds);
      if (!ids.length) return;
      this.loadError = false;
      try {
        const list = await this.$axios.$get(aiExpertiseList(), {
          params: { ids, pageSize: MAX_CONSUMED_EXPERTISES },
        });
        this.expertises = withRead(this.expertises, list.items || []);
        this.readIds = [...this.readIds, ...ids];
      } catch (err) {
        this.loadError = true;
      }
    },
    async runSearch(text) {
      const count = (this.searchCount += 1);
      this.searching = true;
      this.searchError = false;
      try {
        const list = await this.$axios.$get(aiExpertiseList(), {
          params: searchParams(text),
        });
        if (count === this.searchCount) this.results = list.items || [];
      } catch (err) {
        if (count === this.searchCount) this.searchError = true;
      } finally {
        if (count === this.searchCount) this.searching = false;
      }
    },
    // The first list shows when the field is entered, before any typing.
    async searchOnce() {
      if (!this.searchCount) await this.runSearch('');
    },
    emitIds(ids) {
      this.$emit('update:consumedExpertiseIds', ids);
    },
    add(expertiseId) {
      const found = this.results.filter((e) => e.expertiseId === expertiseId);
      // Known from the search: no need to read it again.
      this.expertises = withRead(this.expertises, found);
      this.readIds = [...this.readIds, ...found.map((e) => e.expertiseId)];
      const ids = withConsumed(this.consumedExpertiseIds, expertiseId);
      if (ids.length !== this.consumedExpertiseIds.length) this.emitIds(ids);
      this.$nextTick(() => {
        this.picked = null;
        this.search = null;
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
          <v-btn text small color="error" @click="readConsumed">
            {{ $t('aiSkills.version.consumedExpertisesRetry') }}
          </v-btn>
        </div>
      </v-alert>
      <bs-ai-consumed-expertise-list
        :rows="rows"
        :readonly="readonly"
        @move="move"
        @remove="remove"
      />
      <v-autocomplete
        v-if="!readonly"
        v-model="picked"
        :search-input.sync="search"
        :items="addableItems"
        :label="$t('aiSkills.version.consumedExpertisesAdd')"
        :placeholder="$t('aiSkills.version.consumedExpertisesSearch')"
        :no-data-text="$t('aiSkills.version.consumedExpertisesNoResult')"
        :loading="searching"
        :disabled="full"
        :hint="hint"
        :error-messages="
          searchError
            ? $t('aiSkills.version.consumedExpertisesSearchError')
            : []
        "
        persistent-hint
        no-filter
        outlined
        dense
        class="mt-3"
        @focus="searchOnce"
        @change="add"
      />
    </div>
  </div>
</template>
