<script>
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsCombobox from '~/components/form/bs-combobox.vue';

export default {
  name: 'BsAiExpertiseVersionModal',
  components: { BsModalConfirm, BsTextarea, BsCombobox },
  props: {
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      payload: this.empty(),
    };
  },
  methods: {
    empty() {
      return { body: '', examplesGood: [], examplesBad: [] };
    },
    open() {
      this.payload = this.empty();
      this.$refs.modal.open();
    },
    /**
     * Open the modal pre-filled with the content of an existing version
     * (deep-cloned so the source isn't mutated while editing the draft).
     */
    openWith(version) {
      this.payload = {
        body: version.body || '',
        examplesGood: Array.isArray(version.examplesGood)
          ? [...version.examplesGood]
          : [],
        examplesBad: Array.isArray(version.examplesBad)
          ? [...version.examplesBad]
          : [],
      };
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    onSubmit() {
      this.$emit('submit', { ...this.payload });
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('aiSkills.version.newVersion')"
    :is-form="true"
    modal-width="700"
  >
    <v-form @submit.prevent="onSubmit">
      <bs-textarea
        v-model="payload.body"
        :label="$t('aiSkills.expertise.bodyLabel')"
        :rows="10"
        :disabled="loading"
        monospace
      />
      <bs-combobox
        v-model="payload.examplesGood"
        :label="$t('aiSkills.expertise.goodExamples')"
        multiple
        chips
        small-chips
        :disabled="loading"
      />
      <bs-combobox
        v-model="payload.examplesBad"
        :label="$t('aiSkills.expertise.badExamples')"
        multiple
        chips
        small-chips
        :disabled="loading"
      />
      <v-divider class="mt-4" />
      <div class="modal-actions">
        <v-btn text color="primary" :disabled="loading" @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn type="submit" color="accent" elevation="0" :loading="loading">
          {{ $t('global.create') }}
        </v-btn>
      </div>
    </v-form>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}
</style>
