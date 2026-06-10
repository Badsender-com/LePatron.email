<script>
/* eslint-disable vue/no-mutating-props */
import * as api from '~/helpers/ai-playground-routes.js';
import BsCombobox from '~/components/form/bs-combobox.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsAiExpertisePicker from './BsAiExpertisePicker.vue';

const MODES = ['none', 'explicit', 'filter'];

export default {
  name: 'BsAiPlaygroundExpertiseSelector',
  components: { BsCombobox, BsSelect, BsAiExpertisePicker },
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
          emailType: null,
          language: null,
        });
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
    </template>

    <template v-if="mode === 'filter'">
      <bs-combobox
        :value="expertiseFilter.scope"
        :label="$t('aiPlayground.form.filterScope')"
        multiple
        chips
        small-chips
        :disabled="disabled"
        @input="onScopeChange"
      />
      <bs-combobox
        :value="expertiseFilter.emailType ? [expertiseFilter.emailType] : []"
        :label="$t('aiPlayground.form.filterEmailType')"
        chips
        small-chips
        :disabled="disabled"
        @input="(v) => onEmailTypeChange(Array.isArray(v) ? v[0] : v)"
      />
      <bs-combobox
        :value="expertiseFilter.language ? [expertiseFilter.language] : []"
        :label="$t('aiPlayground.form.filterLanguage')"
        chips
        small-chips
        :disabled="disabled"
        @input="(v) => onLanguageChange(Array.isArray(v) ? v[0] : v)"
      />
      <p
        v-if="filterPreviewCount !== null"
        class="text-caption text--secondary mb-3"
      >
        {{
          $t('aiPlayground.form.filterPreviewCount', {
            count: filterPreviewCount,
          })
        }}
      </p>
    </template>
  </div>
</template>
