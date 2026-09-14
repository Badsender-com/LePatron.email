<script>
// The page owns the scenario object; this form never writes into it. Every
// change emits `input` with a fresh object (plain `v-model` from the page), so
// there is one writer and the page's PATCH always reflects what is on screen.
import * as skillApi from '~/helpers/ai-skill-routes.js';
import * as playgroundApi from '~/helpers/ai-playground-routes.js';
import slugify from '~/helpers/slugify.js';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsCombobox from '~/components/form/bs-combobox.vue';
import BsAiPlaygroundExpertiseSelector from './bs-ai-playground-expertise-selector.vue';
import BsAiPlaygroundInputForm from './bs-ai-playground-input-form.vue';
import BsAiSkillPicker from './bs-ai-skill-picker.vue';

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
    value: { type: Object, required: true },
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
      knownTags: [],
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
      const id = this.value.skillRef && this.value.skillRef.skillId;
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
      const v = this.value.skillRef;
      if (v && v.versionMajor != null) {
        return `${v.versionMajor}.${v.versionMinor || 0}`;
      }
      return null;
    },
    // Schemas are versioned (§3): resolve the input schema of the version the
    // scenario targets (pinned or the skill's active version).
    selectedInputSchemaId() {
      const ref = this.value.skillRef || {};
      const skill = this.skills.find((s) => s.skillId === ref.skillId);
      if (!skill) return null;
      const versions = skill.versions || [];
      let v;
      if (ref.mode === 'pinned' && ref.versionMajor != null) {
        v = versions.find(
          (x) =>
            x.versionMajor === ref.versionMajor &&
            x.versionMinor === (ref.versionMinor || 0)
        );
      } else {
        const av = skill.activeVersion || {};
        v = versions.find(
          (x) =>
            x.versionMajor === av.major && x.versionMinor === (av.minor || 0)
        );
      }
      return (v && v.inputSchemaId) || null;
    },
    selectedSkillCategory() {
      const id = this.value.skillRef && this.value.skillRef.skillId;
      const skill = this.skills.find((s) => s.skillId === id);
      return (skill && skill.category) || null;
    },
  },
  async mounted() {
    await Promise.all([
      this.loadSkills(),
      this.loadExpertise(),
      this.loadTags(),
    ]);
    // Edit case: a skill is already selected — load its versions so the input
    // form can resolve the (versioned) schema.
    const selected = this.value.skillRef && this.value.skillRef.skillId;
    if (selected) {
      await this.ensureReferencedSkillListed(selected);
      await this.ensureSkillVersionsLoaded(selected);
    }
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
    // The list holds ACTIVE skills only. A scenario referencing a skill that
    // has since been archived would otherwise show an empty picker and resolve
    // no input schema, making the reference impossible to even read — let alone
    // replace. Fetch it and append it; the picker badges its status.
    async ensureReferencedSkillListed(skillId) {
      if (!skillId) return;
      if (this.skills.some((s) => s.skillId === skillId)) return;
      try {
        const full = await this.$axios.$get(skillApi.aiSkill(skillId));
        this.skills = [
          ...this.skills,
          { ...full, versions: full.versions || [] },
        ];
      } catch (e) {
        /* a deleted skill stays unresolvable — the form shows it empty */
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
        const res = await this.$axios.$get(skillApi.aiExpertiseList(), {
          params: { status: 'ACTIVE', pageSize: 200 },
        });
        this.availableExpertise = res.items || [];
      } catch (e) {
        this.availableExpertise = [];
      }
    },
    async loadTags() {
      // Suggest existing scenario tags in the tags combobox (free create too).
      // GET /scenarios/facets returns exactly { skillIds, tags }; this used to
      // download 200 complete scenarios to extract their tags, on every mount
      // of the form — creation included, where there is nothing to extract yet.
      try {
        const res = await this.$axios.$get(
          playgroundApi.aiPlaygroundScenarioFacets()
        );
        this.knownTags = (res && res.tags) || [];
      } catch (e) {
        this.knownTags = [];
      }
    },
    update(patch) {
      this.$emit('input', { ...this.value, ...patch });
    },
    onNameInput(name) {
      // The identifier is auto-suggested from the name until the user edits it
      // by hand, and is immutable after creation.
      const patch = { name };
      if (this.creating && !this.identifierManuallyEdited) {
        patch.scenarioId = slugify(name);
      }
      this.update(patch);
    },
    onSkillChange(skillId) {
      const ref = this.value.skillRef;
      this.update({
        skillRef: { ...(ref || {}), skillId, mode: ref ? ref.mode : 'active' },
      });
      this.ensureSkillVersionsLoaded(skillId);
    },
    onSkillModeChange(mode) {
      const ref = this.value.skillRef || { skillId: null };
      this.update({
        skillRef: {
          ...ref,
          mode,
          versionMajor: mode === 'pinned' ? ref.versionMajor : undefined,
          versionMinor: mode === 'pinned' ? ref.versionMinor : undefined,
        },
      });
      if (mode === 'pinned') this.ensureSkillVersionsLoaded(ref.skillId);
    },
    onVersionChange(label) {
      if (!label) return;
      const [major, minor] = label.split('.').map(Number);
      this.update({
        skillRef: {
          ...this.value.skillRef,
          versionMajor: major,
          versionMinor: minor,
        },
      });
    },
    onIdentifierInput(scenarioId) {
      this.identifierManuallyEdited = true;
      this.update({ scenarioId });
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
      :value="value.name"
      :label="$t('aiPlayground.form.name')"
      required
      @input="onNameInput"
    />
    <!-- Identity (creation only — read-only afterwards). Auto-suggested from
         the name; collapsed so consultants never have to think about it. -->
    <template v-if="creating">
      <v-btn
        text
        small
        color="primary"
        class="px-0 mb-1"
        @click="showIdentifier = !showIdentifier"
      >
        {{ $t('aiPlayground.form.scenarioIdToggle') }}
        <span v-if="!showIdentifier && value.scenarioId" class="ml-1">
          — {{ value.scenarioId }}</span
        >
        <v-icon :size="18">
          {{ showIdentifier ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
        </v-icon>
      </v-btn>
      <bs-text-field
        v-if="showIdentifier"
        :value="value.scenarioId"
        :label="$t('aiPlayground.form.scenarioId')"
        :hint="$t('aiPlayground.form.scenarioIdHint')"
        required
        @input="onIdentifierInput"
      />
    </template>
    <bs-textarea
      :value="value.description"
      :label="$t('aiPlayground.form.description')"
      :rows="2"
      @input="update({ description: $event })"
    />
    <bs-combobox
      :value="value.tags"
      :items="knownTags"
      :label="$t('aiPlayground.form.tags')"
      multiple
      chips
      small-chips
      clearable
      @input="update({ tags: $event })"
    />

    <h3 class="form-section-title">
      {{ $t('aiPlayground.form.skillSection') }}
    </h3>
    <bs-ai-skill-picker
      :value="(value.skillRef || {}).skillId"
      :skills="skills"
      :label="$t('aiPlayground.form.skillSelector')"
      @input="onSkillChange"
    />
    <bs-select
      :value="(value.skillRef || {}).mode || 'active'"
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
      v-if="(value.skillRef || {}).mode === 'pinned'"
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
      :expertise-refs="value.expertiseRefs"
      :expertise-filter="value.expertiseFilter"
      :available-expertise="availableExpertise"
      :skill-category="selectedSkillCategory"
      :skill-accepts-expertise="skillAcceptsExpertise"
      @update:mode="$emit('update:expertise-mode', $event)"
      @update:expertise-refs="update({ expertiseRefs: $event })"
      @update:expertise-filter="update({ expertiseFilter: $event })"
    />

    <h3 class="form-section-title">
      {{ $t('aiPlayground.form.inputSection') }}
    </h3>
    <p class="text-caption text--secondary mb-1">
      {{ $t('aiPlayground.form.inputHint') }}
    </p>
    <bs-ai-playground-input-form
      :value="value.input"
      :schema-id="selectedInputSchemaId"
      :field-errors="fieldErrors"
      @input="update({ input: $event })"
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
