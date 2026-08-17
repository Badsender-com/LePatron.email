<script>
/* eslint-disable vue/no-mutating-props */
import * as api from '~/helpers/ai-playground-routes.js';
import { isoLanguageOptions } from '~/helpers/iso-languages.js';
import BsCombobox from '~/components/form/bs-combobox.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsAiExpertisePicker from './BsAiExpertisePicker.vue';
import { ArrowUp, ArrowDown } from 'lucide-vue';

const MODES = ['none', 'explicit', 'filter'];
const EMAIL_TYPES = ['promo', 'newsletter', 'transactional'];
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
      return EMAIL_TYPES;
    },
    languageOptions() {
      return isoLanguageOptions();
    },
    // findApplicable requires a scope in filter mode — drives the required
    // marker and the "select a scope" preview message.
    hasScope() {
      const s = this.expertiseFilter && this.expertiseFilter.scope;
      return Array.isArray(s) && s.length > 0;
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
      // Entering filter mode: pre-fill categories with the skill's category
      // (a good default — findApplicable requires categories). Editable.
      if (next === 'filter') {
        const current = this.expertiseFilter || {};
        const hasCategories =
          Array.isArray(current.categories) && current.categories.length;
        if (!hasCategories && this.skillCategory) {
          this.$emit('update:expertise-filter', {
            ...current,
            categories: [this.skillCategory],
          });
        }
      }
    },
    expertiseFilter: {
      deep: true,
      handler() {
        if (this.mode === 'filter') this.refreshFilterPreview();
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
    if (this.mode === 'filter') this.refreshFilterPreview();
  },
  methods: {
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
    onScopeChange(scope) {
      this.$emit('update:expertise-filter', {
        ...this.expertiseFilter,
        scope: Array.isArray(scope) ? scope : [scope].filter(Boolean),
      });
    },
    onCategoriesChange(categories) {
      this.$emit('update:expertise-filter', {
        ...this.expertiseFilter,
        categories: Array.isArray(categories) ? categories : [],
      });
    },
    onEmailTypeChange(value) {
      this.$emit('update:expertise-filter', {
        ...this.expertiseFilter,
        emailType: value || null,
      });
    },
    onLanguageChange(value) {
      this.$emit('update:expertise-filter', {
        ...this.expertiseFilter,
        language: value || null,
      });
    },
    async refreshFilterPreview() {
      // findApplicable requires a scope — no scope, no preview.
      if (!this.hasScope) {
        this.filterPreviewCount = null;
        return;
      }
      this.previewPending = true;
      try {
        const res = await this.$axios.$get(
          api.aiPlaygroundPreviewExpertiseFilter(),
          { params: this.serialisedFilter() }
        );
        this.filterPreviewCount = res.count;
      } catch (e) {
        this.filterPreviewCount = null;
      } finally {
        this.previewPending = false;
      }
    },
    serialisedFilter() {
      const f = this.expertiseFilter || {};
      const params = {};
      if (Array.isArray(f.scope) && f.scope.length) params.scope = f.scope;
      if (Array.isArray(f.categories) && f.categories.length) {
        params.categories = f.categories;
      }
      if (f.emailType) params.emailType = f.emailType;
      if (f.language) params.language = f.language;
      return params;
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
            <span class="expertise-order__title" :title="e.expertiseId">
              {{ e.title }}
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
        :label="$t('aiPlayground.form.filterCategories')"
        multiple
        chips
        small-chips
        :disabled="disabled"
        @input="onCategoriesChange"
      />
      <bs-combobox
        :value="expertiseFilter.scope"
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

  &__title {
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
