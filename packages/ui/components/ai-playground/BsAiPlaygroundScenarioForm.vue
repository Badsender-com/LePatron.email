<script>
/* eslint-disable vue/no-mutating-props */
import * as skillApi from '~/helpers/ai-skill-routes.js';
import slugify from '~/helpers/slugify.js';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsCombobox from '~/components/form/bs-combobox.vue';
import BsAiPlaygroundExpertiseSelector from './BsAiPlaygroundExpertiseSelector.vue';
import BsAiPlaygroundInputForm from './BsAiPlaygroundInputForm.vue';
import BsAiSkillPicker from './BsAiSkillPicker.vue';

export default {
  name: 'BsAiPlaygroundScenarioForm',
  components: {
    BsTextField,
    BsSelect,
    BsTextarea,
    BsCombobox,
    BsAiPlaygroundExpertiseSelector,
    BsAiPlaygroundInputForm,
    BsAiSkillPicker,
  },
  props: {
    scenario: { type: Object, required: true },
    expertiseMode: { type: String, default: 'none' },
    creating: { type: Boolean, default: false },
    saving: { type: Boolean, default: false },
    // Structured validation errors from the latest execute, displayed inline.
    fieldErrors: { type: Array, default: () => [] },
  },
  data() {
    return {
      skills: [],
      availableExpertise: [],
      groups: [],
      // From the input form's descriptor: whether the selected skill accepts
      // expertise input. Default true so nothing is blocked before load.
      skillAcceptsExpertise: true,
      // scenarioId auto-suggestion (creation only) — same pattern as the
      // skill/expertise create modals: suggest from the name until the user
      // edits the identifier by hand.
      identifierManuallyEdited: false,
      showIdentifier: false,
    };
  },
  computed: {
    skillVersions() {
      const id = this.scenario.skillRef && this.scenario.skillRef.skillId;
      const skill = this.skills.find((s) => s.skillId === id);
      if (!skill || !Array.isArray(skill.versions)) return [];
      return skill.versions
        .slice()
        .sort((a, b) => {
          if (b.versionMajor !== a.versionMajor) {
            return b.versionMajor - a.versionMajor;
          }
          return b.versionMinor - a.versionMinor;
        })
        .map((v) => ({
          value: `${v.versionMajor}.${v.versionMinor}`,
          text: `v${v.versionMajor}.${v.versionMinor} (${v.status})`,
          versionMajor: v.versionMajor,
          versionMinor: v.versionMinor,
        }));
    },
    versionPicked() {
      const v = this.scenario.skillRef;
      if (v && v.versionMajor != null) {
        return `${v.versionMajor}.${v.versionMinor || 0}`;
      }
      return null;
    },
    selectedInputSchemaId() {
      const id = this.scenario.skillRef && this.scenario.skillRef.skillId;
      const skill = this.skills.find((s) => s.skillId === id);
      return (skill && skill.inputSchemaId) || null;
    },
    selectedSkillCategory() {
      const id = this.scenario.skillRef && this.scenario.skillRef.skillId;
      const skill = this.skills.find((s) => s.skillId === id);
      return (skill && skill.category) || null;
    },
  },
  watch: {
    'scenario.name'(name) {
      if (this.creating && !this.identifierManuallyEdited) {
        this.scenario.scenarioId = slugify(name);
      }
    },
  },
  async mounted() {
    await Promise.all([this.loadSkills(), this.loadExpertise()]);
  },
  methods: {
    async loadSkills() {
      try {
        const res = await this.$axios.$get(skillApi.aiSkills(), {
          params: { status: 'ACTIVE', pageSize: 200 },
        });
        // The list endpoint does not include versions; for the picker we
        // fetch the selected skill's full doc on demand. Versions array is
        // built lazily when a skill becomes selected.
        this.skills = (res.items || []).map((s) => ({ ...s, versions: [] }));
      } catch (e) {
        this.skills = [];
      }
    },
    async ensureSkillVersionsLoaded(skillId) {
      const idx = this.skills.findIndex((s) => s.skillId === skillId);
      if (idx < 0) return;
      if (this.skills[idx].versions && this.skills[idx].versions.length) return;
      try {
        const full = await this.$axios.$get(skillApi.aiSkill(skillId));
        this.$set(this.skills, idx, {
          ...this.skills[idx],
          versions: full.versions || [],
        });
      } catch (e) {
        /* swallow */
      }
    },
    async loadExpertise() {
      try {
        // Reuse the ai-expertise list endpoint as a directory.
        const res = await this.$axios.$get('/ai-expertise', {
          params: { status: 'ACTIVE', pageSize: 200 },
        });
        this.availableExpertise = res.items || [];
      } catch (e) {
        this.availableExpertise = [];
      }
    },
    onSkillChange(skillId) {
      this.scenario.skillRef = {
        ...(this.scenario.skillRef || {}),
        skillId,
        mode: this.scenario.skillRef ? this.scenario.skillRef.mode : 'active',
      };
      this.ensureSkillVersionsLoaded(skillId);
    },
    onSkillModeChange(mode) {
      this.scenario.skillRef = {
        ...(this.scenario.skillRef || { skillId: null }),
        mode,
        versionMajor:
          mode === 'pinned' ? this.scenario.skillRef.versionMajor : undefined,
        versionMinor:
          mode === 'pinned' ? this.scenario.skillRef.versionMinor : undefined,
      };
      if (mode === 'pinned') {
        this.ensureSkillVersionsLoaded(this.scenario.skillRef.skillId);
      }
    },
    onVersionChange(label) {
      if (!label) return;
      const [major, minor] = label.split('.').map(Number);
      this.scenario.skillRef = {
        ...this.scenario.skillRef,
        versionMajor: major,
        versionMinor: minor,
      };
    },
    onIdentifierInput(value) {
      this.scenario.scenarioId = value;
      this.identifierManuallyEdited = true;
    },
    onDescriptor(descriptor) {
      // Unknown descriptor (no skill / 404): don't block expertise selection.
      this.skillAcceptsExpertise = descriptor
        ? !!descriptor.hasExpertiseField
        : true;
      this.$emit('descriptor', descriptor);
    },
  },
};
</script>

<template>
  <div>
    <bs-text-field
      v-model="scenario.name"
      :label="$t('aiPlayground.form.name')"
      required
    />
    <!-- Identity (creation only — read-only afterwards). Auto-suggested from
         the name; collapsed so consultants never have to think about it. -->
    <template v-if="creating">
      <a
        class="text-caption d-inline-block mb-2"
        @click="showIdentifier = !showIdentifier"
      >
        {{ $t('aiPlayground.form.scenarioIdToggle') }}
        <span v-if="!showIdentifier && scenario.scenarioId">
          — {{ scenario.scenarioId }}</span>
      </a>
      <bs-text-field
        v-if="showIdentifier"
        :value="scenario.scenarioId"
        :label="$t('aiPlayground.form.scenarioId')"
        :hint="$t('aiPlayground.form.scenarioIdHint')"
        required
        @input="onIdentifierInput"
      />
    </template>
    <bs-textarea
      v-model="scenario.description"
      :label="$t('aiPlayground.form.description')"
      :rows="2"
    />
    <bs-combobox
      v-model="scenario.tags"
      :label="$t('aiPlayground.form.tags')"
      multiple
      chips
      small-chips
    />

    <h3 class="form-section-title">
      {{ $t('aiPlayground.form.skillSection') }}
    </h3>
    <bs-ai-skill-picker
      :value="(scenario.skillRef || {}).skillId"
      :skills="skills"
      :label="$t('aiPlayground.form.skillSelector')"
      @input="onSkillChange"
    />
    <bs-select
      :value="(scenario.skillRef || {}).mode || 'active'"
      :items="[
        { value: 'active', text: $t('aiPlayground.form.versionModeActive') },
        { value: 'pinned', text: $t('aiPlayground.form.versionModePinned') },
      ]"
      item-text="text"
      item-value="value"
      :label="$t('aiPlayground.form.versionMode')"
      @input="onSkillModeChange"
    />
    <bs-select
      v-if="(scenario.skillRef || {}).mode === 'pinned'"
      :value="versionPicked"
      :items="skillVersions"
      item-text="text"
      item-value="value"
      :label="$t('aiPlayground.form.versionPicker')"
      @input="onVersionChange"
    />

    <h3 class="form-section-title">
      {{ $t('aiPlayground.form.expertiseSection') }}
    </h3>
    <bs-ai-playground-expertise-selector
      :mode="expertiseMode"
      :expertise-refs="scenario.expertiseRefs"
      :expertise-filter="scenario.expertiseFilter"
      :available-expertise="availableExpertise"
      :skill-category="selectedSkillCategory"
      :skill-accepts-expertise="skillAcceptsExpertise"
      @update:mode="$emit('update:expertise-mode', $event)"
      @update:expertise-refs="scenario.expertiseRefs = $event"
      @update:expertise-filter="scenario.expertiseFilter = $event"
    />

    <h3 class="form-section-title">
      {{ $t('aiPlayground.form.inputSection') }}
    </h3>
    <p class="text-caption text--secondary mb-1">
      {{ $t('aiPlayground.form.inputHint') }}
    </p>
    <bs-ai-playground-input-form
      :value="scenario.input"
      :schema-id="selectedInputSchemaId"
      :field-errors="fieldErrors"
      @input="scenario.input = $event"
      @valid="$emit('input-valid', $event)"
      @descriptor="onDescriptor"
    />
  </div>
</template>

<style lang="scss" scoped>
.form-section-title {
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.6);
}
</style>
