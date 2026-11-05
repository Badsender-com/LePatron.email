<script>
// The page owns the skill object; this form never writes into it. Every field
// emits `input` with a fresh object (v-model on the component), so the flow of
// state stays one-directional and the page is the single writer.
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import {
  skillCategoryOptions,
  audienceOptions,
  AUDIENCE_ITEM_KINDS,
  AUDIENCES,
  SKILL_NATURES,
} from '~/helpers/ai-skill-categories.js';

export default {
  name: 'BsAiSkillDetailsForm',
  components: { BsTextField, BsSelect, BsTextarea },
  props: {
    value: { type: Object, required: true },
    saving: { type: Boolean, default: false },
  },
  computed: {
    categoryOptions() {
      return skillCategoryOptions(this);
    },
    // Worded for what the skill is: its active version's nature, else its
    // latest draft's.
    audienceOptions() {
      return audienceOptions(
        this,
        this.nature === SKILL_NATURES.TASK
          ? AUDIENCE_ITEM_KINDS.TASK_SKILL
          : AUDIENCE_ITEM_KINDS.FEATURE_SKILL
      );
    },
    // One stored before audiences has none until the migration opens it, and
    // no client uses it meanwhile: shown as the platform company's.
    audience() {
      return this.value.audience || AUDIENCES.PLATFORM;
    },
    // The nature is the active version's (ADR 0013), set on a draft version;
    // the mark only counts while the active version is a feature skill's.
    activeVersion() {
      const av = this.value.activeVersion;
      if (!av || av.major == null) return null;
      return (this.value.versions || []).find(
        (v) => v.versionMajor === av.major && v.versionMinor === (av.minor || 0)
      );
    },
    nature() {
      const versions = this.value.versions || [];
      const version = this.activeVersion || versions[versions.length - 1];
      return (version && version.nature) || SKILL_NATURES.FEATURE;
    },
    activeIsTask() {
      return (
        !!this.activeVersion && this.activeVersion.nature === SKILL_NATURES.TASK
      );
    },
  },
  methods: {
    update(patch) {
      this.$emit('input', { ...this.value, ...patch });
    },
  },
};
</script>

<template>
  <v-card outlined class="pa-4">
    <bs-text-field
      :value="value.title"
      :label="$t('global.title')"
      @input="update({ title: $event })"
    />
    <bs-textarea
      :value="value.description"
      :label="$t('global.description')"
      :rows="2"
      @input="update({ description: $event })"
    />
    <bs-select
      :value="value.category"
      :items="categoryOptions"
      item-text="text"
      item-value="value"
      :label="$t('aiSkills.filters.category')"
      @input="update({ category: $event })"
    />
    <bs-select
      :value="audience"
      :items="audienceOptions"
      item-text="text"
      item-value="value"
      :label="$t('aiSkills.audience')"
      :hint="$t('aiSkills.audienceHint')"
      persistent-hint
      @input="update({ audience: $event })"
    />
    <v-checkbox
      v-if="!activeIsTask"
      :input-value="value.servedToAssistants === true"
      :label="$t('aiSkills.servedToAssistants')"
      :hint="$t('aiSkills.servedToAssistantsHint')"
      persistent-hint
      dense
      class="mt-2"
      @change="update({ servedToAssistants: $event === true })"
    />

    <div class="d-flex justify-end mt-3">
      <v-btn
        color="accent"
        elevation="0"
        :loading="saving"
        @click="$emit('save')"
      >
        {{ $t('global.save') }}
      </v-btn>
    </div>
  </v-card>
</template>
