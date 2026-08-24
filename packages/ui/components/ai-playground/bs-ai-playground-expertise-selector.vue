<script>
/* eslint-disable vue/no-mutating-props */
import * as api from '~/helpers/ai-playground-routes.js';
import { aiExpertiseFacets } from '~/helpers/ai-skill-routes.js';
import { isoLanguageOptions } from '~/helpers/iso-languages.js';
import { emailTypeOptions } from '~/helpers/email-types.js';
import {
  hasFilterScope,
  hasFilterCategories,
  needsCategoryDefault,
  serialiseExpertiseFilter,
} from '~/helpers/expertise-filter.js';
import BsCombobox from '~/components/form/bs-combobox.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsAiExpertisePicker from './bs-ai-expertise-picker.vue';
import { ArrowUp, ArrowDown } from 'lucide-vue';

const MODES = ['none', 'explicit', 'filter'];
const CATEGORIES = [
  'redaction',
  'qc',
  'design',
  'html_integration',
  'deliverability',
  'translation',
  'other',
];

export default {
  name: 'BsAiPlaygroundExpertiseSelector',
  components: {
    BsCombobox,
    BsSelect,
    BsAiExpertisePicker,
    LucideArrowUp: ArrowUp,
    LucideArrowDown: ArrowDown,
  },
  props: {
    mode: { type: String, default: 'none' }, // 'none' | 'explicit' | 'filter'
    expertiseRefs: { type: Array, default: () => [] },
    expertiseFilter: { type: Object, default: () => ({}) },
    availableExpertise: { type: Array, default: () => [] },
    // Category of the selected skill: same-category expertise is listed first.
    skillCategory: { type: String, default: null },
    // From the skill's schema descriptor: when false, the skill has no
    // expertise input — selecting expertise would be silently useless, so the
    // explicit/filter modes are blocked with an explanation.
    skillAcceptsExpertise: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
  },
  data() {
    return {
      filterPreviewCount: null,
      previewPending: false,
      // Existing scope values (same source as the expertise modal) so the
      // filter-mode scope field proposes known scopes; free entry stays allowed.
      scopeFacets: [],
    };
  },
  computed: {
    modeOptions() {
      return MODES.map((value) => ({
        value,
        text: this.$t(
          'aiPlayground.form.expertiseMode' +
            value.charAt(0).toUpperCase() +
            value.slice(1)
        ),
      }));
    },
    expertiseIds() {
      return this.expertiseRefs.map((r) => r.expertiseId);
    },
    // Selected expertises in their prompt order, hydrated with a display title
    // (falls back to the id when the expertise list has not loaded yet).
    orderedExpertise() {
      const byId = new Map(
        (this.availableExpertise || []).map((e) => [e.expertiseId, e])
      );
      return this.expertiseRefs.map((ref) => {
        const doc = byId.get(ref.expertiseId);
        return {
          expertiseId: ref.expertiseId,
          title: (doc && doc.title) || ref.expertiseId,
        };
      });
    },
    categoryOptions() {
      return CATEGORIES.map((value) => ({
        value,
        text: this.$t(`aiSkills.categories.${value}`),
      }));
    },
    emailTypeOptions() {
      return emailTypeOptions(this);
    },
    languageOptions() {
      return isoLanguageOptions();
    },
    // findApplicable requires a scope in filter mode — drives the required
    // marker and the "select a scope" preview message.
    hasScope() {
      return hasFilterScope(this.expertiseFilter);
    },
    hasCategories() {
      return hasFilterCategories(this.expertiseFilter);
    },
    // Reactive rule (both input orders): in filter mode, categories defaults to
    // the skill's category as long as none is set. Fires when mode becomes
    // 'filter' OR when the skill category resolves — no ad-hoc pre-fill to race.
    categoryDefaultNeeded() {
      return needsCategoryDefault(
        this.mode,
        this.skillCategory,
        this.expertiseFilter
      );
    },
  },
  watch: {
    mode(next) {
      // Reset the inactive field so the scenario payload stays clean.
      if (next === 'none' || next === 'filter') {
        this.$emit('update:expertise-refs', []);
      }
      if (next === 'none' || next === 'explicit') {
        this.$emit('update:expertise-filter', {
          scope: [],
          categories: [],
          emailType: null,
          language: null,
        });
      }
    },
    categoryDefaultNeeded: {
      immediate: true,
      handler(needed) {
        // emitFilter also refreshes the preview, so the count updates as soon
        // as scope is present — regardless of skill→mode vs mode→skill order.
        if (needed) this.emitFilter({ categories: [this.skillCategory] });
      },
    },
    skillAcceptsExpertise(accepts) {
      // The newly selected skill has no expertise input: selecting expertise
      // would silently do nothing useful — fall back to 'none'.
      if (!accepts && this.mode !== 'none') {
        this.$emit('update:mode', 'none');
      }
    },
  },
  mounted() {
    this.loadScopeFacets();
    if (this.mode === 'filter') this.refreshFilterPreview();
  },
  methods: {
    async loadScopeFacets() {
      try {
        const res = await this.$axios.$get(aiExpertiseFacets());
        this.scopeFacets = (res && res.scopes) || [];
      } catch (e) {
        this.scopeFacets = [];
      }
    },
    onModeChange(value) {
      this.$emit('update:mode', value);
    },
    // Reorder the explicit selection: the runner composes the prompt in
    // expertiseRefs order, so this list is the order the model sees.
    moveExpertise(index, delta) {
      const next = index + delta;
      if (next < 0 || next >= this.expertiseRefs.length) return;
      const refs = [...this.expertiseRefs];
      const [moved] = refs.splice(index, 1);
      refs.splice(next, 0, moved);
      this.$emit('update:expertise-refs', refs);
    },
    onExplicitChange(values) {
      // values is an array of expertiseId strings (from combobox); turn each
      // back into a ref object with mode 'active' by default. Existing refs
      // keep their mode/pinned version if present.
      const existingById = new Map(
        this.expertiseRefs.map((r) => [r.expertiseId, r])
      );
      const next = values.map(
        (id) => existingById.get(id) || { expertiseId: id, mode: 'active' }
      );
      this.$emit('update:expertise-refs', next);
    },
    // Each filter change emits the updated filter AND refreshes the preview
    // from that exact value (§4 fix). The preview is driven directly by the
    // field event, not by a round-trip through the parent prop — the combobox
    // change was no longer re-triggering the count otherwise.
    emitFilter(patch) {
      const next = { ...this.expertiseFilter, ...patch };
      this.$emit('update:expertise-filter', next);
      if (this.mode === 'filter') this.refreshFilterPreviewFor(next);
    },
    onScopeChange(scope) {
      this.emitFilter({
        scope: Array.isArray(scope) ? scope : [scope].filter(Boolean),
      });
    },
    onCategoriesChange(categories) {
      this.emitFilter({
        categories: Array.isArray(categories) ? categories : [],
      });
    },
    onEmailTypeChange(value) {
      this.emitFilter({ emailType: value || null });
    },
    onLanguageChange(value) {
      this.emitFilter({ language: value || null });
    },
    refreshFilterPreview() {
      this.refreshFilterPreviewFor(this.expertiseFilter);
    },
    async refreshFilterPreviewFor(filter) {
      // findApplicable requires BOTH scope and categories — an incomplete
      // filter shows an explicit message instead of calling the endpoint.
      if (!hasFilterScope(filter) || !hasFilterCategories(filter)) {
        this.filterPreviewCount = null;
        return;
      }
      this.previewPending = true;
      try {
        const res = await this.$axios.$get(
          api.aiPlaygroundPreviewExpertiseFilter(),
          { params: serialiseExpertiseFilter(filter) }
        );
        this.filterPreviewCount = res.count;
      } catch (e) {
        this.filterPreviewCount = null;
      } finally {
        this.previewPending = false;
      }
    },
  },
};
</script>

<template>
  <div>
    <v-alert
      v-if="!skillAcceptsExpertise"
      type="info"
      dense
      outlined
      class="mb-3"
    >
      {{ $t('aiPlayground.form.expertiseNotSupported') }}
    </v-alert>

    <bs-select
      v-if="skillAcceptsExpertise"
      :value="mode"
      :items="modeOptions"
      item-text="text"
      item-value="value"
      :label="$t('aiPlayground.form.expertiseMode')"
      :disabled="disabled"
      @input="onModeChange"
    />
    <p
      v-if="skillAcceptsExpertise"
      class="text-caption text--secondary mt-n2 mb-3"
    >
      {{ $t('aiPlayground.form.expertiseModeHelp') }}
    </p>

    <v-alert
      v-if="skillAcceptsExpertise && mode === 'none'"
      type="info"
      dense
      outlined
      class="mt-2 mb-3"
    >
      {{ $t('aiPlayground.form.expertiseNoneWarning') }}
    </v-alert>

    <template v-if="mode === 'explicit'">
      <bs-ai-expertise-picker
        :value="expertiseIds"
        :expertise="availableExpertise"
        :skill-category="skillCategory"
        :label="$t('aiPlayground.form.expertiseSelector')"
        :disabled="disabled"
        @input="onExplicitChange"
      />
      <template v-if="orderedExpertise.length">
        <ul class="expertise-order">
          <li
            v-for="(e, i) in orderedExpertise"
            :key="e.expertiseId"
            class="expertise-order__item"
          >
            <span class="expertise-order__rank">{{ i + 1 }}.</span>
            <span class="expertise-order__labels">
              <span class="expertise-order__title">{{ e.title }}</span>
              <span class="expertise-order__slug">{{ e.expertiseId }}</span>
            </span>
            <v-spacer />
            <v-btn
              icon
              x-small
              :disabled="disabled || i === 0"
              @click="moveExpertise(i, -1)"
            >
              <lucide-arrow-up :size="16" />
            </v-btn>
            <v-btn
              icon
              x-small
              :disabled="disabled || i === orderedExpertise.length - 1"
              @click="moveExpertise(i, 1)"
            >
              <lucide-arrow-down :size="16" />
            </v-btn>
          </li>
        </ul>
        <p class="text-caption text--secondary mb-3">
          {{ $t('aiPlayground.form.expertiseOrderHint') }}
        </p>
      </template>
    </template>

    <template v-if="mode === 'filter'">
      <bs-select
        :value="expertiseFilter.categories || []"
        :items="categoryOptions"
        item-text="text"
        item-value="value"
        :label="`${$t('aiPlayground.form.filterCategories')} *`"
        multiple
        chips
        small-chips
        :disabled="disabled"
        @input="onCategoriesChange"
      />
      <bs-combobox
        :value="expertiseFilter.scope"
        :items="scopeFacets"
        :label="`${$t('aiPlayground.form.filterScope')} *`"
        :hint="$t('aiPlayground.form.filterScopeHint')"
        persistent-hint
        multiple
        chips
        small-chips
        :disabled="disabled"
        @input="onScopeChange"
      />
      <bs-select
        :value="expertiseFilter.emailType || null"
        :items="emailTypeOptions"
        item-text="text"
        item-value="value"
        :label="$t('aiPlayground.form.filterEmailType')"
        :hint="$t('aiPlayground.form.filterEmailTypeHint')"
        persistent-hint
        clearable
        :disabled="disabled"
        @input="onEmailTypeChange"
      />
      <bs-select
        :value="expertiseFilter.language || null"
        :items="languageOptions"
        item-text="text"
        item-value="value"
        :label="$t('aiPlayground.form.filterLanguage')"
        :hint="$t('aiPlayground.form.filterLanguageHint')"
        persistent-hint
        clearable
        :disabled="disabled"
        @input="onLanguageChange"
      />
      <p class="text-caption text--secondary mb-1 mt-2">
        <span v-if="!hasScope">
          {{ $t('aiPlayground.form.filterSelectScope') }}
        </span>
        <span v-else-if="!hasCategories">
          {{ $t('aiPlayground.form.filterSelectCategory') }}
        </span>
        <span v-else-if="filterPreviewCount !== null">
          {{
            $t('aiPlayground.form.filterPreviewCount', {
              count: filterPreviewCount,
            })
          }}
        </span>
      </p>
      <p class="text-caption text--disabled mb-3">
        {{ $t('aiPlayground.form.filterOrderHint') }}
      </p>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.expertise-order {
  list-style: none;
  margin: 0 0 0.25rem;
  padding: 0;

  &__item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    margin-bottom: 0.25rem;
  }

  &__rank {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.5);
    min-width: 1.25rem;
  }

  &__labels {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &__title {
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__slug {
    font-size: 0.7rem;
    color: rgba(0, 0, 0, 0.45);
    font-family: monospace;
  }
}
</style>
