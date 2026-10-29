<script>
// What a task skill's version holds (ADR 0013): the procedure an assistant
// follows, and the expertises it consumes, in the order it reads them. The
// panel owns the draft; this component only emits the new values.
import BsTextarea from '~/components/form/bs-textarea.vue';
import { aiExpertiseList } from '~/helpers/ai-skill-routes.js';

export default {
  name: 'BsAiSkillTaskVersionFields',
  components: { BsTextarea },
  props: {
    procedure: { type: String, default: '' },
    consumedExpertiseIds: { type: Array, default: () => [] },
    readonly: { type: Boolean, default: false },
  },
  data() {
    return { expertises: [], loading: false };
  },
  computed: {
    expertiseItems() {
      return this.expertises.map((e) => ({
        value: e.expertiseId,
        text: `${e.title} (${e.expertiseId})`,
      }));
    },
  },
  async mounted() {
    this.loading = true;
    try {
      const list = await this.$axios.$get(aiExpertiseList(), {
        params: { status: 'ACTIVE', pageSize: 200 },
      });
      this.expertises = list.items || [];
    } catch (err) {
      this.expertises = [];
    } finally {
      this.loading = false;
    }
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
    <v-autocomplete
      :value="consumedExpertiseIds"
      :items="expertiseItems"
      :label="$t('aiSkills.version.consumedExpertises')"
      :hint="$t('aiSkills.version.consumedExpertisesHint')"
      :loading="loading"
      :readonly="readonly"
      :disabled="readonly"
      persistent-hint
      multiple
      chips
      small-chips
      deletable-chips
      outlined
      dense
      class="mt-4"
      @input="$emit('update:consumedExpertiseIds', $event)"
    />
  </div>
</template>
