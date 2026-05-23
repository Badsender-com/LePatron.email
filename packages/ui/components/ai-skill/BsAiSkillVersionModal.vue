<script>
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';

export default {
  name: 'BsAiSkillVersionModal',
  components: { BsModalConfirm, BsTextarea },
  props: {
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      payload: { systemPrompt: '', skillBody: '', inputTemplate: '' },
    };
  },
  methods: {
    open() {
      this.payload = { systemPrompt: '', skillBody: '', inputTemplate: '' };
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
        v-model="payload.systemPrompt"
        :label="$t('aiSkills.version.systemPrompt')"
        :rows="3"
        :disabled="loading"
        monospace
      />
      <bs-textarea
        v-model="payload.skillBody"
        :label="$t('aiSkills.version.skillBody')"
        :rows="4"
        :disabled="loading"
        monospace
      />
      <bs-textarea
        v-model="payload.inputTemplate"
        :label="$t('aiSkills.version.inputTemplate')"
        :rows="3"
        :disabled="loading"
        monospace
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
