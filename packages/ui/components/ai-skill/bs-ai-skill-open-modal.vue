<script>
// Before a task skill opens to every company from its details (ADR 0013):
// the expertises its active version consumes that are kept to the platform
// company, each of which may be opened with it. A warning, never a block:
// with none checked, the skill opens without them.
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsAiOpenExpertisesChoice from '~/components/ai-skill/bs-ai-open-expertises-choice.vue';

export default {
  name: 'BsAiSkillOpenModal',
  components: { BsModalConfirm, BsAiOpenExpertisesChoice },
  data() {
    return { expertises: [], openExpertiseIds: [] };
  },
  methods: {
    // `expertises`: [{ expertiseId, title }], none checked.
    open(expertises) {
      this.expertises = expertises;
      this.openExpertiseIds = [];
      this.$refs.modal.open();
    },
    confirm() {
      this.$emit('confirm', [...this.openExpertiseIds]);
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('aiSkills.openExpertises.skillTitle')"
    :action-label="$t('aiSkills.version.openToAll')"
    action-button-color="accent"
    modal-width="500"
    @confirm="confirm"
  >
    <bs-ai-open-expertises-choice
      v-model="openExpertiseIds"
      :expertises="expertises"
    />
  </bs-modal-confirm>
</template>
