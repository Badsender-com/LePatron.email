<script>
// Before an expertise open to every company is kept to the platform company
// again (ADR 0013): the open task skills whose active version consumes it,
// which the assistants of the other companies then follow without it. A
// warning, never a block.
import BsModalConfirm from '~/components/modal-confirm.vue';

export default {
  name: 'BsAiExpertiseCloseModal',
  components: { BsModalConfirm },
  data() {
    return { skills: [] };
  },
  methods: {
    // `skills`: [{ skillId, title }].
    open(skills) {
      this.skills = skills;
      this.$refs.modal.open();
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('aiSkills.closeExpertise.title')"
    :action-label="$t('global.save')"
    action-button-color="accent"
    modal-width="500"
    @confirm="$emit('confirm')"
  >
    <v-alert type="warning" dense outlined class="mb-0 text-caption">
      <div>{{ $t('aiSkills.closeExpertise.intro') }}</div>
      <ul class="consuming-skills mt-1">
        <li v-for="skill in skills" :key="skill.skillId">
          <span class="font-weight-medium text--primary">{{
            skill.title
          }}</span>
          <code>{{ skill.skillId }}</code>
        </li>
      </ul>
    </v-alert>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.consuming-skills {
  padding-left: 1.1rem;
}
.consuming-skills code {
  font-size: 0.72rem;
  background: none;
  padding: 0 0 0 0.25rem;
}
</style>
